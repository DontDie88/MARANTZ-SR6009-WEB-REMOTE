# config.py
# Central configuration file for the Marantz Remote Control application.
import os

# --- Network Settings ---
# IMPORTANT: This is the most critical setting.
# Please verify the IP address of your Marantz receiver on your local network
# and update the value below. You can usually find this in your receiver's
# on-screen menu under Setup -> Network -> Information.
MARANTZ_IP = os.getenv("MARANTZ_IP", "192.168.1.203")

# The standard Telnet port for Marantz/Denon receivers. Do not change unless you have a custom setup.
MARANTZ_TELNET_PORT = 23

# --- Application Settings ---
# Timeout in seconds for network operations to the receiver.
TELNET_OPERATION_TIMEOUT = 5

# The delay in seconds before attempting to reconnect after a connection is lost.
RECONNECT_DELAY_SECONDS = 10

# The interval in seconds to send a keep-alive command to prevent the receiver
# from closing the idle connection.
KEEP_ALIVE_INTERVAL_SECONDS = 120

# --- Flask Server Settings ---
# The host address for the web server to listen on.
# '0.0.0.0' means it will be accessible from other devices on your network.
FLASK_HOST = '0.0.0.0'

# The port for the Flask web server.
FLASK_PORT = 5000

# The secret key for Flask session management. Generated randomly for security.
FLASK_SECRET_KEY = os.urandom(24)

# Flask debug mode. Set to False in a production environment.
# Read from environment variable, default to True for development.
# The check for 'true' (case-insensitive) is a robust way to handle boolean env vars.
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "False").lower() in ('true', '1', 't')