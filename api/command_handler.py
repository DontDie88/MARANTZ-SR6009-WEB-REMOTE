import logging
from flask import Flask, jsonify
from flask_socketio import SocketIO

from marantz_remote.telnet_client import MarantzTelnetClient

logger = logging.getLogger(__name__)

# --- Constants ---
QUERY_GROUP_DELAY = 0.1  # Delay in seconds between commands in a query group
MACRO_DELAY = 0.2        # Delay in seconds between commands in a macro

def _handle_setter_command(client: MarantzTelnetClient, command_name: str, command_info: dict, value: str | None):
    """Handles commands of type 'setter' which require a value."""
    if value is None:
        return jsonify({"success": False, "message": f"Command '{command_name}' requires a value."}), 400

    try:
        numeric_value = float(value)
    except (ValueError, TypeError):
        return jsonify({"success": False, "message": f"Invalid numeric value '{value}' for command '{command_name}'."}), 400

    if 'value_range' in command_info:
        min_val, max_val = command_info['value_range']
        if not (min_val <= numeric_value <= max_val):
            return jsonify({"success": False, "message": f"Value '{value}' is out of range ({min_val}-{max_val}) for {command_name}."}), 400

    if 'formatter' in command_info:
        formatted_value = command_info['formatter'](value)
    elif 'value_format' in command_info:
        # Use the validated numeric_value directly for formatting to avoid precision loss.
        # The format string itself (e.g., "{:03.0f}") can handle casting to int if needed.
        # FIX: The 'd' format specifier requires an integer, but numeric_value is a float. Cast to int.
        formatted_value = command_info['value_format'].format(int(numeric_value))
    else:
        formatted_value = value

    final_command = command_info['code'].format(value=formatted_value)
    success, message, _ = client.send_command(final_command)
    return jsonify({"success": success, "message": f"Command '{final_command}' sent. Status: {message}"})

def _handle_action_or_query_command(client: MarantzTelnetClient, command_info: dict, value: str | None = None):
    """Handles commands of type 'action' or 'query'."""
    final_command = command_info['code']
    success, message, _ = client.send_command(final_command)
    return jsonify({"success": success, "message": f"Command '{final_command}' sent. Status: {message}"})

def _handle_query_group_command(client: MarantzTelnetClient, socketio: SocketIO, command_name: str, command_info: dict, command_map: dict, value: str | None = None):
    """Handles commands of type 'query_group'."""
    command_list = command_info.get('commands', [])
    if not command_list:
        return jsonify({"success": False, "message": "Query group is empty."}), 500

    for sub_command_name in command_list:
        sub_command_info = command_map.get(sub_command_name)
        if sub_command_info and sub_command_info['type'] == 'query':
            client.send_command_fire_and_forget(sub_command_info['code'])
            socketio.sleep(QUERY_GROUP_DELAY)  # type: ignore
        else:
            logger.warning(f"Invalid or non-query command '{sub_command_name}' in query group '{command_name}'.")
    return jsonify({"success": True, "message": f"Query group '{command_name}' executed successfully."})

def _handle_macro_command(client: MarantzTelnetClient, socketio: SocketIO, command_name: str, command_info: dict, command_map: dict, value: str | None = None):
    """Handles commands of type 'macro'."""
    command_list = command_info.get('commands', [])
    if not command_list:
        return jsonify({"success": False, "message": "Macro command is empty."}), 500

    for sub_command_name in command_list:
        sub_command_info = command_map.get(sub_command_name)
        if sub_command_info:
            client.send_command(sub_command_info['code'])
        else:
            logger.error(f"Invalid sub-command '{sub_command_name}' in macro '{command_name}'.")
        socketio.sleep(MACRO_DELAY)  # type: ignore

    return jsonify({"success": True, "message": f"Macro '{command_name}' executed successfully."})

def register_command_handler(app: Flask, client: MarantzTelnetClient, socketio: SocketIO, command_map: dict):
    """Registers the main API command endpoint with the Flask app."""
    
    COMMAND_HANDLERS = {
        'setter': lambda name, info, val: _handle_setter_command(client, name, info, val),
        'action': lambda name, info, val: _handle_action_or_query_command(client, info),
        'query': lambda name, info, val: _handle_action_or_query_command(client, info),
        'query_group': lambda name, info, val: _handle_query_group_command(client, socketio, name, info, command_map),
        'macro': lambda name, info, val: _handle_macro_command(client, socketio, name, info, command_map),
    }

    @app.route('/api/command/<string:command_name>', methods=['POST'])
    @app.route('/api/command/<string:command_name>/<string:value>', methods=['POST'])
    def handle_api_command(command_name: str, value: str | None = None):
        # Prevent command spam and errors when the receiver is disconnected.
        if not client.is_connected():
            logger.warning(f"Blocked command '{command_name}' because client is not connected.")
            return jsonify({"success": False, "message": "Not connected to receiver"}), 503

        command_info = command_map.get(command_name)
        if not command_info:
            return jsonify({"success": False, "message": f"Unknown command: {command_name}"}), 404

        command_type = command_info['type']
        handler = COMMAND_HANDLERS.get(command_type)

        if not handler:
            return jsonify({"success": False, "message": f"Unsupported command type for '{command_name}'"}), 500

        return handler(command_name, command_info, value)