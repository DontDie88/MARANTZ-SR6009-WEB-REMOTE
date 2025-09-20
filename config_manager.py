import json
import logging
import os
# Import defaults as fallbacks
from config import MARANTZ_IP as DEFAULT_MARANTZ_IP
from config import FLASK_HOST as DEFAULT_FLASK_HOST, FLASK_PORT as DEFAULT_FLASK_PORT

logger = logging.getLogger(__name__)

# --- NEW: Define a dedicated, system-wide folder for the application's data ---
# This ensures the config file is always in a predictable location, not the desktop.
# C:\ProgramData is the standard location for this on Windows.
APP_DATA_DIR = os.path.join(os.environ.get('ProgramData', 'C:/ProgramData'), 'Marantz SR6009 Remote')
CONFIG_FILE = os.path.join(APP_DATA_DIR, 'config.json')


# --- Default Input Names ---
# This dictionary maps the receiver's internal source code (e.g., 'SAT/CBL')
# to the default display name. This is the single source of truth for defaults.
DEFAULT_INPUT_NAMES = {
    'SAT/CBL': 'SAT/CBL',
    'BT': 'BLUETOOTH',
    'TV': 'TV AUDIO',
    'BD': 'BLU-RAY',
    'DVD': 'DVD',
    'GAME': 'GAME',
    'MPLAY': 'MEDIA PLAYER',
    'AUX1': 'AUX1',
    'AUX2': 'AUX2',
    'TUNER': 'TUNER',
    'USB/IPOD': 'iPod/USB',
    'CD': 'CD',
    'NET': 'ONLINE MUSIC',
    'PHONO': 'PHONO',
    'IRADIO': 'INTERNET RADIO',
    'PANDORA': 'PANDORA',
    'FAVORITES': 'FAVORITES'
}

class ConfigManager:
    """Manages loading, saving, and accessing configuration data like custom input names."""

    def __init__(self):
        self._input_names = {}
        self._receiver_ip = DEFAULT_MARANTZ_IP
        self._server_host = DEFAULT_FLASK_HOST
        self._server_port = DEFAULT_FLASK_PORT
        self.load_config()

    def load_config(self):
        """Loads configuration from the JSON file, falling back to defaults."""
        # Start with the hardcoded defaults.
        # This ensures we always have a base IP to work with from the code.
        self._receiver_ip = DEFAULT_MARANTZ_IP
        self._server_host = DEFAULT_FLASK_HOST
        self._server_port = DEFAULT_FLASK_PORT
        self._input_names = DEFAULT_INPUT_NAMES.copy()
        
        # Ensure the application data directory exists.
        os.makedirs(APP_DATA_DIR, exist_ok=True)

        if not os.path.exists(CONFIG_FILE):
            logger.info(f"'{CONFIG_FILE}' not found. Creating with default settings.")
            # Save the defaults to create the file for the first time.
            self.save_config()
            return
        
        config_was_updated = False
        try:
            with open(CONFIG_FILE, 'r') as f:
                data = json.load(f)

            # Check and load each config key, marking for update if missing
                if 'receiver_ip' in data:
                    self._receiver_ip = data['receiver_ip']
                else:
                    logger.warning(f"'receiver_ip' not found in {CONFIG_FILE}. It will be added using the default from config.py.")
                    config_was_updated = True

            if 'server_host' in data:
                self._server_host = data['server_host']
            else:
                logger.warning(f"'server_host' not found in {CONFIG_FILE}. Adding default.")
                config_was_updated = True

            if 'server_port' in data:
                self._server_port = data['server_port']
            else:
                logger.warning(f"'server_port' not found in {CONFIG_FILE}. Adding default.")
                config_was_updated = True

                # Load custom input names
                custom_names = data.get('input_names', {})
                # Merge custom names over the defaults. This ensures that if new
                # inputs are added to the defaults, they are included until customized.
                self._input_names.update(custom_names)
                logger.info(f"Successfully loaded configuration from '{CONFIG_FILE}'.")
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading '{CONFIG_FILE}': {e}. Using default names.")
            # In case of a corrupt file, fall back to defaults.
            self._receiver_ip = DEFAULT_MARANTZ_IP
            self._server_host = DEFAULT_FLASK_HOST
            self._server_port = DEFAULT_FLASK_PORT
            self._input_names = DEFAULT_INPUT_NAMES.copy()
        
        if config_was_updated:
            self.save_config()

    def save_config(self):
        """Saves the current configuration to the JSON file."""
        try:
            data_to_save = {
                'receiver_ip': self._receiver_ip,
                'server_host': self._server_host,
                'server_port': self._server_port,
                'input_names': self._input_names
            }
            with open(CONFIG_FILE, 'w') as f:
                json.dump(data_to_save, f, indent=4)
            logger.info(f"Configuration saved to '{CONFIG_FILE}'.")
        except IOError as e:
            logger.error(f"Error saving config to '{CONFIG_FILE}': {e}")

    def get_input_names(self) -> dict:
        """Returns the current mapping of input codes to display names."""
        return self._input_names.copy()

    def get_receiver_ip(self) -> str:
        """Returns the configured receiver IP address."""
        return self._receiver_ip

    def get_server_host(self) -> str:
        """Returns the configured server host address."""
        return self._server_host

    def get_server_port(self) -> int:
        """Returns the configured server port."""
        return self._server_port

    def set_receiver_ip(self, new_ip: str):
        """Updates the receiver IP address and saves the configuration."""
        self._receiver_ip = new_ip
        self.save_config()
        logger.info(f"Receiver IP address set to '{new_ip}'.")

    def set_input_name(self, input_code: str, new_name: str):
        """Updates a single input name and saves the configuration."""
        if input_code in self._input_names:
            self._input_names[input_code] = new_name
            self.save_config()
            logger.info(f"Input '{input_code}' renamed to '{new_name}'.")
        else:
            logger.warning(f"Attempted to rename an unknown input code: '{input_code}'.")

    def reset_input_names(self):
        """Resets all input names to their default values and saves."""
        self._input_names = DEFAULT_INPUT_NAMES.copy()
        self.save_config()
        logger.info("Input names have been reset to defaults.")