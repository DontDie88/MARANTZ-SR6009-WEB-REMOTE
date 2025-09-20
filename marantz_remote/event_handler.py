import logging
import re
from flask_socketio import SocketIO

from .response_parser import parse_response

logger = logging.getLogger(__name__)

class TelnetEventHandler:
    """
    Handles the logic for processing raw data received from the Telnet client,
    parsing it, and emitting structured events via Socket.IO.
    """
    def __init__(self, socketio_instance: SocketIO):
        """
        Initializes the event handler with a Socket.IO instance.
        :param socketio_instance: The Flask-SocketIO instance.
        """
        self.socketio = socketio_instance

    def process_data(self, raw_data: bytes) -> None:
        """
        Decodes raw data, processes it line by line, and emits structured events.
        The receiver sends data in mixed encodings (UTF-8 and latin-1). This method
        attempts to decode as UTF-8 first, and falls back to latin-1 if that fails,
        which correctly handles all known text from the device.
        """
        try:
            # Attempt to decode as UTF-8, the modern standard. This will correctly
            # handle multi-byte characters like in 'Motörhead'.
            decoded_data = raw_data.decode('utf-8')
        except UnicodeDecodeError:
            # If UTF-8 fails, it's likely an older single-byte encoding from a
            # source like Pandora. Fall back to latin-1 for 'Mötley Crüe'.
            decoded_data = raw_data.decode('latin-1')

        # The receiver can send multiple commands in one chunk, separated by either
        # carriage returns (\r) or newlines (\n). We must split the data into
        # individual lines to be processed one by one. This also normalizes the
        # "multi-line packet" format into the "fragmented packet" format that the
        # stateful parser is designed to handle.
        for part in re.split(r'[\r\n]+', decoded_data):
            line = part.strip()
            if not line:
                continue # Skip any empty lines that result from the split.
            
            parsed_event = parse_response(line)
            if parsed_event:
                # The parser is now stateful and only returns an event if something has changed.
                # We can trust it and emit the event directly.
                event_name, event_data = parsed_event
                logger.info("Parsed to structured event '%s': %s", event_name, event_data)
                self.socketio.emit(event_name, event_data)
            else:
                # A `None` return from the parser can mean it's a valid first-half
                # of a fragmented message, so we no longer treat it as an error.
                # We only log it for debugging purposes if needed.
                logger.debug("Parser returned None for line: %r", line)