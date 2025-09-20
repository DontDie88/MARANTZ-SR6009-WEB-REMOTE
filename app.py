# app.py

# --- Standard Library Imports ---
import logging
import sys

# --- Third-Party Imports ---
from flask import Flask, jsonify, render_template
from flask_socketio import SocketIO

# --- Local Application Imports ---
import config
from api import command_handler
from commands import COMMAND_MAP
from marantz_remote.event_handler import TelnetEventHandler
from marantz_remote.telnet_client import MarantzTelnetClient
from config_manager import ConfigManager

# ==============================================================================
# 1. INITIAL SETUP & CONFIGURATION
# ==============================================================================
# --- Logging Configuration ---
# Configure logging to output to the console.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# --- Flask and SocketIO Initialization ---
app = Flask(__name__)
app.config['SECRET_KEY'] = config.FLASK_SECRET_KEY
# Use 'threading' mode for SocketIO to work correctly with the background Telnet thread.
socketio = SocketIO(app, async_mode='threading')

# --- Configuration Manager Initialization ---
config_manager = ConfigManager()

# --- Get Receiver IP from Config Manager ---
# This makes the IP configurable via the config.json file, which is user-friendly.
receiver_ip = config_manager.get_receiver_ip()

# ==============================================================================
# 2. APPLICATION COMPONENT INITIALIZATION
# ==============================================================================
# --- Application Components Initialization ---
# The TelnetEventHandler is responsible for parsing raw data from the receiver
# and emitting structured WebSocket events to the frontend.
event_handler = TelnetEventHandler(socketio_instance=socketio)

def on_connection_lost():
    """Callback function for when the Telnet connection is lost."""
    logger.warning("Connection to receiver lost. Notifying frontend.")
    socketio.emit('receiver_disconnected', {'message': 'Connection to receiver lost. Reconnecting...'})

def on_connection_established():
    """Callback for when the Telnet connection is re-established."""
    logger.info("Connection to receiver established. Notifying frontend.")
    socketio.emit('receiver_connected', {'message': 'Successfully connected to receiver.'})
    # A new client might have connected while we were down, or we might be
    # starting up. In either case, get the full status now.
    perform_initial_sync()

def perform_initial_sync():
    """
    Sends all the necessary query commands to the receiver to get its full
    initial state. This is called when a client connects or when the backend
    re-establishes its connection to the receiver.
    """
    logger.info("Performing initial status sync by sending individual query commands...")
    initial_sync_command_info = COMMAND_MAP.get('INITIAL_STATUS_QUERY')
    if not initial_sync_command_info or initial_sync_command_info['type'] != 'query_group':
        logger.error("INITIAL_STATUS_QUERY not found or is not a query_group in COMMAND_MAP.")
        return

    command_list = initial_sync_command_info.get('commands', [])
    for sub_command_name in command_list:
        sub_command_info = COMMAND_MAP.get(sub_command_name)
        if sub_command_info and sub_command_info['type'] == 'query':
            telnet_client.send_command_fire_and_forget(sub_command_info['code'])
            # The telnet client has a built-in delay, so no explicit sleep is needed here.
        else:
            logger.warning(f"Invalid or non-query command '{sub_command_name}' in INITIAL_STATUS_QUERY.")

# The MarantzTelnetClient manages the persistent, asynchronous connection
# to the receiver in a background thread.
telnet_client = MarantzTelnetClient(
    host = receiver_ip,
    port=config.MARANTZ_TELNET_PORT,
    data_callback=event_handler.process_data,  # type: ignore
    connection_lost_callback=on_connection_lost,
    connection_established_callback=on_connection_established
)

# The command_handler registers the API endpoints (e.g., /api/command/...)
# with the Flask app, giving the frontend a way to send commands.
command_handler.register_command_handler(app, telnet_client, socketio, COMMAND_MAP)

# ==============================================================================
# 3. FLASK & SOCKETIO ROUTING
# ==============================================================================
# --- Flask Routes ---
@app.route('/')
def index():
    """Serves the main remote control web page."""
    return render_template('index.html', input_names=config_manager.get_input_names())

# --- SocketIO Event Handlers ---
@socketio.on('connect')
def handle_connect():
    """Handles a new client connecting via WebSocket."""
    logger.info("Client connected via WebSocket.")
    # --- Send current input names to the new client ---
    socketio.emit('input_names_update', config_manager.get_input_names())

    # Immediately inform the new client of the current receiver connection status.
    # This is crucial for mobile clients that disconnect/reconnect when switching apps.
    if telnet_client.is_connected():
        logger.info("Receiver is connected. Notifying new client and performing sync.")
        # Tell the client the overlay can be removed.
        socketio.emit('receiver_connected', {'message': 'Successfully connected to receiver.'})
        # Send the full status.
        perform_initial_sync()
    else:
        logger.warning("Client connected, but receiver is not. Notifying client to show overlay.")
        # Tell the client to show the disconnected overlay.
        socketio.emit('receiver_disconnected', {'message': 'Connection to receiver lost. Reconnecting...'})

@socketio.on('rename_input')
def handle_rename_input(data):
    """Handles a request from a client to rename an input."""
    input_code = data.get('input_code')
    new_name = data.get('new_name')
    if not input_code or new_name is None: # Allow empty string for name
        logger.warning("Invalid rename_input request: missing data.")
        return

    logger.info(f"Client requested rename: {input_code} -> '{new_name}'")
    config_manager.set_input_name(input_code, new_name)
    
    # Broadcast the updated names to all clients so their UIs stay in sync.
    socketio.emit('input_names_update', config_manager.get_input_names())

@socketio.on('set_receiver_ip')
def handle_set_receiver_ip(data):
    """Handles a request to update the receiver's IP address."""
    new_ip = data.get('ip')
    if not new_ip:
        logger.warning("Invalid set_receiver_ip request: missing IP.")
        return

    logger.info(f"Client requested to set receiver IP to: {new_ip}")
    config_manager.set_receiver_ip(new_ip)

    # Notify the client that the IP was saved and a restart is needed.
    socketio.emit('ip_update_success', {
        'message': f"Receiver IP saved as {new_ip}. Please restart the application for the change to take effect."
    })

@socketio.on('reset_input_names')
def handle_reset_input_names():
    """Handles a request to reset all input names to their defaults."""
    logger.info("Client requested to reset input names.")
    config_manager.reset_input_names()
    
    # Broadcast the default names to all clients.
    socketio.emit('input_names_update', config_manager.get_input_names())

# ==============================================================================
# 4. APPLICATION ENTRY POINT
# ==============================================================================
# --- Application Entry Point ---
if __name__ == '__main__':
    try:
        # Step 1: Start the Telnet client's background thread. It will begin
        # trying to connect to the receiver.
        logger.info("Starting Marantz Telnet client...")
        telnet_client.start()
        # Step 2: Start the Flask-SocketIO web server. This is a blocking call
        # that will run until the application is stopped (e.g., with Ctrl+C).
        logger.info("Starting Flask-SocketIO server...")
        # The `use_reloader=False` is critical. The Flask auto-reloader can cause
        # issues with background threads and external connections like our Telnet client.
        # It was causing the app to restart immediately, preventing the Telnet
        # client in the second process from connecting.
        socketio.run(
            app,
            host=config_manager.get_server_host(),
            port=config_manager.get_server_port(),
            debug=config.FLASK_DEBUG, use_reloader=False,
            allow_unsafe_werkzeug=True
        )
    finally:
        # Step 3: When the server is shut down, this block ensures that the
        # Telnet client is gracefully closed.
        logger.info("Application shutting down. Closing Telnet client.")
        telnet_client.close()