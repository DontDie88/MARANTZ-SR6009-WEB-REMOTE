# response_parser.py
import re
import time
import logging
from typing import Dict, Any, Optional, Tuple, Callable

# Set up logging for this module
logger = logging.getLogger(__name__)
 
# --- OSD State Management Class ---
# NEW: Encapsulate the complex state and logic for OSD parsing into a class.
# This makes the state management explicit and contained, rather than using a global-like dictionary.
class OsdParser:
    # --- Constants for NSE line prefixes ---
    # These non-printable characters signify the type of content on a given line.
    NOW_PLAYING_CHAR = '\x01'  # SOH (Start of Heading) -> Indicates a "Now Playing" info line
    CONTEXT_MENU_CHAR = '\x02' # STX (Start of Text) -> Indicates a context menu action
    SELECTED_ITEM_CHAR = '\x04' # EOT (End of Transmission) -> The item with the cursor
    MENU_ITEM_CHAR = '\x05'    # ENQ (Enquiry) -> A selectable menu item
    PLAYING_ITEM_CHAR = '$'    # Standard ASCII character used as a flag

    # NEW: A set of additional characters that also signify a selectable menu item,
    # discovered from device logs. Includes ACK ('\x06'), LF/Newline ('\x0a'),
    # and SO ('\x0e').
    SPECIAL_MENU_ITEM_CHARS = {'\x06', '\x0a', '\x0e'}

    # --- Constants for screen modes ---
    MODE_NOW_PLAYING = 'now_playing'
    MODE_MENU = 'menu'
    MODE_CONTEXT_MENU = 'context_menu'

    def __init__(self, context_timeout_seconds: int = 5):
        self.context_timeout = context_timeout_seconds
        self.context = self._create_default_context()
        # NEW: State to handle fragmented messages for selected OSD items.
        self._pending_selected_line: Optional[int] = None
 
    def _clean_osd_text(self, text: str) -> str:
        """Removes non-printable ASCII characters from OSD text and strips whitespace."""
        # This regex removes control characters from \x00-\x1F and \x7F (DEL).
        return re.sub(r'[\x00-\x1F\x7F]', '', text).strip()
 
    def _create_default_context(self) -> Dict[str, Any]:
        """Returns a clean context dictionary."""
        return {
            "screen_mode": None, # The current mode of the OSD (e.g., 'menu', 'now_playing')
            "last_update_time": 0,
            "screen_title": "",
            "cursor_line": -1,
            "menu_items": {},
        }
 
    def _reset_context_if_timed_out(self):
        """Resets the context if no updates have been received within the timeout period."""
        current_time = time.time()
        if current_time - self.context["last_update_time"] > self.context_timeout:
            # If the screen hasn't updated in a while, we can't be sure of its mode.
            # Resetting to None forces re-detection on the next line.
            self.context["screen_mode"] = None
        self.context["last_update_time"] = current_time
 
    def _handle_title_line(self, text: str) -> Tuple[str, Dict[str, Any]]:
        """Handles parsing of the title line (NSE0)."""
        # Only reset the context if the screen title has actually changed.
        # This prevents status polls from wiping the context unnecessarily.
        if text != self.context.get("screen_title"):
            logger.info(f"OSD screen changed to: '{text}'")
            self.context = self._create_default_context() # Reset context on new screen
            # A new screen means any pending fragmented line is now invalid.
            self._pending_selected_line = None
            self.context["screen_title"] = text
        
        # Always update the timestamp to prevent a timeout.
        self.context["last_update_time"] = time.time()
        
        # Set the initial screen mode based on the title.
        # This is a fallback for when the first line doesn't have a signifier.
        if text.lower() == 'now playing':
            self.context['screen_mode'] = self.MODE_NOW_PLAYING
        # The context menu is specifically titled "Menu". Other menus like "Setup Menu"
        # are handled by the generic menu mode.
        elif text == 'Menu':
            self.context['screen_mode'] = self.MODE_CONTEXT_MENU
        else:
            self.context['screen_mode'] = self.MODE_MENU

        return 'osd_title_update', {'text': text}
 
    def _handle_now_playing_line(self, line: int, raw_text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Handles parsing of lines within a 'Now Playing' context."""
        # Each line in "Now Playing" mode has a specific purpose. We check them one by one.
        if line == 1 and raw_text.startswith(self.NOW_PLAYING_CHAR):
            text = self._clean_osd_text(raw_text[1:])
            return 'now_playing_title_update', {'text': text}
        
        if line == 2 and raw_text.startswith(self.NOW_PLAYING_CHAR):
            text = self._clean_osd_text(raw_text[1:])
            return 'now_playing_artist_update', {'text': text}
            
        if line == 3 and raw_text.startswith(self.NOW_PLAYING_CHAR):
            text = self._clean_osd_text(raw_text[1:])
            if text:
                return 'now_playing_samplerate_update', {'text': text}
            
        if line == 4:
            # The album line is inconsistent; it sometimes lacks the standard prefix.
            # We handle both cases by checking for the prefix and stripping it if present.
            text_to_clean = raw_text[1:] if raw_text.startswith(self.NOW_PLAYING_CHAR) else raw_text
            text = self._clean_osd_text(text_to_clean)
            if text:
                return 'now_playing_album_update', {'text': text}
            
        if line == 5:
            # Line 5 contains time and progress, but no standard signifier.
            # We clean it of any potential null characters before parsing.
            text = self._clean_osd_text(raw_text)
            
            # Search for both time and percentage independently.
            time_match = re.search(r'(\d{1,2}:\d{2}(?::\d{2})?)', text)
            percent_match = re.search(r'(\d{1,3})%', text)

            time_val = time_match.group(1) if time_match else None
            percent_val = int(percent_match.group(1)) if percent_match else None

            # Only send an update if we found at least one piece of information.
            if time_val is not None or percent_val is not None:
                return 'play_progress_update', {'time': time_val, 'percent': percent_val}

        return None
 
    def _handle_menu_line(self, line: int, raw_text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Handles parsing of generic OSD menu lines, including item types and cursor position."""
        # Determine the type of menu item and its state based on the signifier.
        is_selected = raw_text.startswith(self.SELECTED_ITEM_CHAR)
        is_menu_item = (raw_text.startswith(self.MENU_ITEM_CHAR) or
                        raw_text.startswith(self.CONTEXT_MENU_CHAR) or
                        (raw_text and raw_text[0] in self.SPECIAL_MENU_ITEM_CHARS))

        # The actual text content starts after the signifier character.
        text = self._clean_osd_text(raw_text[1:])

        # Update the cursor line in our context if this is the selected item.
        if is_selected:
            self.context["cursor_line"] = line

        # For lines 1-7, emit a structured menu item update.
        # The line number check is redundant as this handler is only called for lines 1-7.
        if is_menu_item or is_selected:
            return 'osd_menu_item_update', {
                'line': line,
                'text': text,
                'is_selected': is_selected,
            }
        return None
 
    def _handle_context_menu_line(self, line: int, raw_text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Handles parsing of lines within a 'Context Menu' (e.g., Pandora actions)."""
        if line in range(1, 8):
            # A line is selected if it does NOT start with the context menu character.
            # This handles multi-line messages (e.g., starting with '\n') and fragmented messages.
            is_selected = not raw_text.startswith(self.CONTEXT_MENU_CHAR)

            # NEW: Strip any leading non-printable control characters and whitespace.
            # This makes the parser resilient to different delimiters like \x02, \n, etc.
            text = self._clean_osd_text(raw_text)
            if text: # Only return an event if there's actual text content
                return 'osd_context_menu_item_update', {
                    'line': line,
                    'text': text,
                    'is_selected': is_selected,
                }
        return None
 
    def parse(self, response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Parses an NSE (Network Screen Event) response. This is the main entry point for this class."""
        # --- Stateful OSD Fragment Handling ---
        # This logic allows the OSD parser to handle all OSD-related lines, including
        # fragments that don't start with 'NSE', improving encapsulation.
        if self._pending_selected_line is not None and not response.startswith('NSE'):
            line = self._pending_selected_line
            text = self._clean_osd_text(response)
            # Consume the pending state.
            self._pending_selected_line = None
            # Check the parser's current mode to determine which event to send.
            current_mode = self.context.get('screen_mode')
            if current_mode == self.MODE_CONTEXT_MENU:
                event_name = 'osd_context_menu_item_update'
                logger.info("Reconstructed fragmented CONTEXT menu item on line %d: %s", line, text)
            else: # Default to standard menu
                event_name = 'osd_menu_item_update'
                logger.info("Reconstructed fragmented MENU item on line %d: %s", line, text)

            return event_name, {
                'line': line,
                'text': text,
                'is_selected': True,  # A reconstructed fragment is always the selected item.
            }

        # Use re.DOTALL to ensure that the text part can contain newlines, which happens
        # when the receiver sends a selected item and its text in a single packet.
        match = re.match(r'^NSE(\d)(.*)$', response, re.DOTALL)
        if not match: return None
 
        line, raw_text = int(match.group(1)), match.group(2)
 
        self._reset_context_if_timed_out()

        if line == 0:
            # The title line has no signifier, so we pass the cleaned text.
            text = self._clean_osd_text(raw_text)
            return self._handle_title_line(text)

        # Handle pagination line (NSE8) as a special case since it's common to all menus
        if line == 8:
            # The station info line can sometimes include a '$' prefix. We strip it for display.
            text = self._clean_osd_text(raw_text.lstrip(self.PLAYING_ITEM_CHAR))
            if text:
                return 'station_info_update', {'text': text}
            return None # Ignore empty pagination line

        # Handle fragmented messages for selected items (e.g., "NSE2" with no text)
        if self.context.get('screen_mode') in (self.MODE_MENU, self.MODE_CONTEXT_MENU) and not raw_text.strip():
            self._pending_selected_line = line
            logger.debug("Buffering partial menu command for line %d in mode %s", line, self.context.get('screen_mode'))
            return None

        # If screen mode is not yet determined, try to detect it from the first content line.
        current_mode = self.context.get('screen_mode')
        if not current_mode:
            if raw_text.startswith(self.NOW_PLAYING_CHAR):
                current_mode = self.MODE_NOW_PLAYING
            elif raw_text.startswith(self.MENU_ITEM_CHAR) or raw_text.startswith(self.SELECTED_ITEM_CHAR):
                current_mode = self.MODE_MENU
            elif raw_text.startswith(self.CONTEXT_MENU_CHAR) or raw_text.startswith('\n'):
                current_mode = self.MODE_CONTEXT_MENU
            self.context['screen_mode'] = current_mode

        # Dispatch to the correct handler based on the current mode.
        if self.context['screen_mode'] == self.MODE_NOW_PLAYING:
            return self._handle_now_playing_line(line, raw_text)
        elif self.context['screen_mode'] == self.MODE_MENU:
            return self._handle_menu_line(line, raw_text)
        elif self.context['screen_mode'] == self.MODE_CONTEXT_MENU:
            return self._handle_context_menu_line(line, raw_text)
        
        logger.warning("Could not handle OSD line in unknown mode for line %d: %r", line, raw_text)
        return None

def _parse_value_with_half_step(raw_val_str: str) -> float:
    """
    Parses a raw value string from the receiver that may represent a .5 step.
    e.g., "50" -> 50.0, "505" -> 50.5
    """
    # Receiver uses 3 digits for .5 steps (e.g., 505) and 2 for whole steps (e.g., 50)
    # This also handles single-digit values correctly.
    return float(raw_val_str) / 10.0 if len(raw_val_str) == 3 else float(raw_val_str)

def _create_on_off_parser(prefix: str, on_val: str, off_val: str) -> Callable[[str], Optional[Dict[str, Any]]]:
    """
    Factory function to create a simple on/off state parser.
    This reduces code duplication for commands that follow a simple
    PREFIX + ON/OFF pattern.
    """
    len_prefix = len(prefix)

    def parser(response: str) -> Optional[Dict[str, Any]]:
        # Check if the response starts with the correct prefix
        if not response.startswith(prefix):
            return None

        # Extract the state part of the response
        state_part = response[len_prefix:]

        if state_part == on_val:
            return {'state': 'on'}
        if state_part == off_val:
            return {'state': 'standby' if off_val == 'STANDBY' else 'off'}
        return None
    return parser

def _create_multi_state_parser(
    pattern: str,
    normalization_map: Optional[Dict[str, str]] = None
) -> Callable[[str], Optional[Dict[str, Any]]]:
    """
    Factory function to create a parser for commands with multiple, distinct states.
    - `pattern`: A regex string with one capturing group for the state.
    - `normalization_map`: An optional dictionary to map captured states to normalized values.
    """
    compiled_regex = re.compile(pattern)

    def parser(response: str) -> Optional[Dict[str, Any]]:
        match = compiled_regex.match(response)
        if not match:
            return None

        state = match.group(1).lower()

        # Normalize the state if a map is provided and the state is in it
        if normalization_map and state in normalization_map:
            state = normalization_map[state]

        return {'state': state}
    return parser

def _parse_volume(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Parses MV (Main Volume) and MVMAX (Max Volume) responses.
    - "MV35"   -> ('volume_update', {'value': 35.0})
    - "MV355"  -> ('volume_update', {'value': 35.5})
    - "MVMAX 73" -> ('max_volume_update', {'value': 73.0})
    - "MVMAX735" -> ('max_volume_update', {'value': 73.5})
    """
    # Check for Max Volume first, as it's more specific
    max_match = re.match(r'^MVMAX\s?(\d+)$', response)
    if max_match:
        raw_val_str = max_match.group(1)
        value = _parse_value_with_half_step(raw_val_str)
        return 'max_volume_update', {'value': value}

    # Check for standard Volume
    vol_match = re.match(r'^MV(\d+)$', response)
    if vol_match:
        raw_val_str = vol_match.group(1)
        value = _parse_value_with_half_step(raw_val_str)
        return 'volume_update', {'value': value}

    return None

# Create a parser for Mute status using the factory
_parse_mute = _create_on_off_parser('MU', 'ON', 'OFF')

# NEW: Create a parser for the master subwoofer on/off status.
_parse_subwoofer_status = _create_on_off_parser('PSSWR ', 'ON', 'OFF')

def _parse_dialog_level(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses PSDIL (Dialog Level) responses into a structured dictionary.

    The receiver uses different formats for on, off, and value states.
    - "PSDILOFF" -> {'state': 'off'}
    - "PSDILON"  -> {'state': 'on'} (Value is often sent in a subsequent update)
    - "PSDIL50"  -> {'state': 'on', 'value': 50.0} (0dB)
    - "PSDIL505" -> {'state': 'on', 'value': 50.5} (+0.5dB)
    """
    if response in ("PSDIL OFF", "PSDILOFF"):
        return {'state': 'off'}
    if response in ("PSDIL ON", "PSDILON"):
        # This is an acknowledgement, not a full state update. Return a consistent
        # payload to prevent frontend errors, but the value is unknown from this message.
        return {'state': 'on'}

    # EDITED: Handle optional space before the value.
    match = re.match(r'^PSDIL\s?(\d+)$', response)
    if match:
        raw_val_str = match.group(1)
        value = _parse_value_with_half_step(raw_val_str)
        # FIX: A level response does NOT imply the feature is 'on'.
        # The 'on'/'off' state is handled by a separate response.
        return {'value': value}
    return None

# Create a parser for M-DAX status using the multi-state factory
_parse_mdax = _create_multi_state_parser(
    # EDITED: Handle optional space.
    r'^PSMDAX\s?(OFF|LOW|MED|HI)$',
    {'med': 'medium', 'hi': 'high'}
)

# Create parsers for simple on/off features using the factory
_parse_cinema_eq = _create_on_off_parser('PSCINEQ', 'ON', 'OFF')
_parse_dynamic_eq = _create_on_off_parser('PSDYNEQ', 'ON', 'OFF')

# Create a parser for Dynamic Volume using the multi-state factory
_parse_dynamic_volume = _create_multi_state_parser(
    # EDITED: Handle optional space.
    r'^PSDYNVOL\s?(OFF|LIT|MED|HEV)$',
    {'lit': 'light', 'med': 'medium', 'hev': 'heavy'}
)

def _parse_picture_mode(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses PV (Picture Mode) responses using a direct lookup map.
    """
    mode_map = {
        "PVOFF": "off",
        "PVSTD": "standard",
        "PVMOV": "movie",
        "PVVVD": "vivid",
        "PVSTM": "stream",
        "PVCTM": "custom",
        "PVDAY": "isf_day",
        "PVNGT": "isf_night",
    }
    if response in mode_map:
        return {'state': mode_map[response]}
    return None

# Create a parser for Graphic EQ using the factory
_parse_graphic_eq = _create_on_off_parser('PSGEQ', 'ON', 'OFF')

# Create a parser for Tone Control using the factory.
# The space in the prefix is intentional and handled correctly by the parser.
_parse_tone_control = _create_on_off_parser('PSTONE CTRL ', 'ON', 'OFF')

def _parse_center_gain(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses PSCEG (Center Gain) responses.
    The receiver sends a 2-digit value from 00-10.
    - "PSCEG05" -> {'value': 0.5}
    - "PSCEG10" -> {'value': 1.0}
    """
    # EDITED: Handle optional space.
    match = re.match(r'^PSCEG\s?(\d{2})$', response)
    if match:
        raw_val = int(match.group(1))
        db_value = float(raw_val) / 10.0
        return {'value': db_value}
    return None

# Create a parser for Dynamic Range Compression using the multi-state factory
_parse_dynamic_range_compression = _create_multi_state_parser(
    r'^PSDRC\s(OFF|LOW|MID|HI)$',
    {'mid': 'medium', 'hi': 'high'}
)

# Create a parser for ECO Mode using the multi-state factory
_parse_eco_mode = _create_multi_state_parser(r'^PSEC\s?(ON|AUTO|OFF)$')

# NEW: Create a parser for Audyssey Dynamic Compression
_parse_audyssey_dyn_comp = _create_multi_state_parser(r'^PSDCA\s?(AUTO|OFF)$')

# EDITED: Expanded to handle more sound detail types found in logs.
_parse_sound_detail = _create_multi_state_parser(r'^SD\s?(AUTO|ANALOG|HDMI|ARC)$')

# NEW: Create a parser for the DC (Digital Input Control?) signal type.
_parse_digital_control = _create_multi_state_parser(r'^DC(AUTO|ANALOG|HDMI|DIGITAL)$')

# NEW: Create a factory for simple numeric value parsers like tone controls.
def _create_numeric_parser(prefix: str) -> Callable[[str], Optional[Dict[str, Any]]]:
    """Factory to create parsers for simple numeric values (e.g., tone controls)."""
    # This regex handles the prefix, an optional space, and the numeric value.
    compiled_regex = re.compile(f'^{re.escape(prefix)}\\s?(\\d+)$')

    def parser(response: str) -> Optional[Dict[str, Any]]:
        match = compiled_regex.match(response)
        if match:
            # The value is returned raw; UI can handle scaling (e.g., 50-based).
            return {'level': int(match.group(1))}
        return None
    return parser

def _parse_system_lock(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Parses SY... LOCK ... responses.
    - "SYREMOTE LOCK ON" -> ('remote_lock_update', {'state': 'on'})
    - "SYPANEL LOCK OFF" -> ('panel_lock_update', {'state': 'off'})
    """
    match = re.match(r'^(SYREMOTE|SYPANEL(?:\+V)?) LOCK (ON|OFF)$', response)
    if match:
        # Use match.groups() for cleaner, type-safe access.
        lock_type_raw, state_raw = match.groups()
        lock_type = lock_type_raw.lower()
        state = state_raw.lower()
        event_name = 'remote_lock_update' if lock_type == 'syremote' else 'panel_lock_update'
        return event_name, {'state': state}
    return None

def _parse_sound_mode(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses MS (Sound Mode) responses.
    - "MSMOVIE" -> {'mode': 'MOVIE'}
    """
    # The dispatch table ensures this function only receives 'MS' responses,
    # not 'MSSMART' responses, so the check for 'MSSMART' is not needed.
    if response.startswith('MS'):
        return {'mode': response[2:]}
    return None

def _parse_smart_select(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses MSSMART (Smart Select) responses.
    - "MSSMART1" -> {'selection': 'MSSMART1'}
    """
    if response.startswith('MSSMART'):
        return {'selection': response}
    return None

def _parse_play_state(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses NSF and CRPLYSTS (Playback State) responses.
    - "NSF PLAY" -> {'state': 'PLAY'}
    """
    if response.startswith(('NSF ', 'CRPLYSTS ')):
        state = response.split(' ', 1)[1]
        return {'state': state}
    return None

# Create a single, stateful instance of the OSD parser for the application to use.
_osd_parser = OsdParser()

def _parse_sleep_timer(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses SLP (Sleep Timer) responses.
    - "SLPOFF" -> {'state': 'off'}
    - "SLP060" -> {'state': 'on', 'minutes': 60}
    """
    if response == 'SLPOFF':
        return {'state': 'off'}
    
    match = re.match(r'^SLP(\d+)$', response)
    if match:
        minutes = int(match.group(1))
        # The receiver sends SLP000 when the timer expires, treat it as off.
        if minutes == 0:
            return {'state': 'off'}
        return {'state': 'on', 'minutes': minutes}
    return None

def _parse_tuner_status(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Parses various Tuner status responses and routes them to the correct event.
    - "TMANFM"    -> ('tuner_mode_update', {'mode': 'FM'})
    - "TFAN09850" -> ('tuner_frequency_update', {'frequency': '98.50'})
    - "TPAN05"    -> ('tuner_preset_update', {'preset': '05'})
    """
    if response.startswith('TMAN'):
        mode = response[4:]
        return 'tuner_mode_update', {'mode': mode}

    if response.startswith('TFAN'):
        freq_str = response[4:]
        # EDITED: Handle non-numeric frequency responses (e.g., station name).
        if not freq_str.strip().isdigit():
            return 'tuner_name_update', {'name': freq_str.strip()}

        # FM frequencies are typically 4 or 5 digits (e.g., 9850 for 98.5, 10710 for 107.1)
        # AM frequencies are typically 3 or 4 digits (e.g., 830, 1040)
        if len(freq_str) >= 4 and '.' not in freq_str:
            # Assume FM format with 2 decimal places
            freq = int(freq_str) / 100.0
            return 'tuner_frequency_update', {'frequency': f'{freq:.2f}'}
        else:
            # Handle AM or already formatted frequencies
            return 'tuner_frequency_update', {'frequency': str(int(freq_str))}

    if response.startswith('TPAN'):
        preset = response[4:]
        return 'tuner_preset_update', {'preset': preset}

    # NOTE: HD Tuner responses (TMHD, TFHD, TPHD) can be added here following the same pattern.

    return None

def _parse_video_select(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Parses SV (Video Select) responses.
    - "SVON" -> ('video_select_mode_update', {'state': 'on'})
    - "SVOFF" -> ('video_select_mode_update', {'state': 'off'})
    - "SVMPLAY" -> ('video_select_source_update', {'source': 'MPLAY'})
    """
    if response == "SVON":
        return 'video_select_mode_update', {'state': 'on'}
    if response == "SVOFF":
        return 'video_select_mode_update', {'state': 'off'}

    # Check for source, which is more general and must come after ON/OFF
    if response.startswith('SV'):
        source = response[2:]
        # Ensure we don't parse "SV" by itself and that the source is not just a query '?'
        if source and source != '?':
            return 'video_select_source_update', {'source': source}
    return None

def _parse_trigger(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Parses TR (Trigger) responses.
    - "TR1 ON" -> ('trigger_1_update', {'state': 'on'})
    """
    match = re.match(r'^TR([12])\s(ON|OFF)$', response)
    if match:
        trigger_num, state = match.groups()
        event_name = f'trigger_{trigger_num}_update'
        return event_name, {'state': state.lower()}
    return None

def _parse_zone2(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Parses various Zone 2 responses and routes them to the correct event.
    - "Z2ON" / "Z2OFF" -> ('zone2_power_update', {'state': 'on'/'off'})
    - "Z2MUON" / "Z2MUOFF" -> ('zone2_mute_update', {'state': 'on'/'off'})
    - "Z2##" (volume) -> ('zone2_volume_update', {'value': ##})
    - "Z2SOURCE" (input) -> ('zone2_input_source_update', {'source': 'SOURCE'})
    """
    if response in ("Z2ON", "Z2OFF"):
        return 'zone2_power_update', {'state': 'on' if response == "Z2ON" else 'off'}
    
    if response in ("Z2MUON", "Z2MUOFF"):
        return 'zone2_mute_update', {'state': 'on' if response == "Z2MUON" else 'off'}

    # EDITED: Check for volume (e.g., Z250 or Z2505 for 50.5)
    # Changed regex from \d{2} to \d+ to handle variable-length digits.
    vol_match = re.match(r'^Z2(\d+)$', response)
    if vol_match:
        raw_val_str = vol_match.group(1)
        # Handle potential .5 steps (3-digit value) like the main volume
        value = _parse_value_with_half_step(raw_val_str)
        return 'zone2_volume_update', {'value': value}

    # Check for input source (e.g., Z2CD, Z2DVD)
    # This is less specific, so it comes after volume.
    input_match = re.match(r'^Z2([A-Z/]+)$', response)
    if input_match:
        return 'zone2_input_source_update', {'source': input_match.group(1)}

    return None

def _parse_reference_level(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses PSREFLEV (Reference Level Offset) responses.
    - "PSREFLEV 0" -> {'value': 0}
    - "PSREFLEV 5" -> {'value': 5}
    """
    match = re.match(r'^PSREFLEV\s(\d+)$', response)
    if match:
        return {'value': int(match.group(1))}
    return None

def _parse_subwoofer_level_adjust(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses PSSWL (Subwoofer Level Adjust) responses.
    - "PSSWL ON"  -> {'state': 'on'}
    - "PSSWL OFF" -> {'state': 'off'}
    - "PSSWL 54"  -> {'value': 4.0} (50-offset)
    - "PSSWL 515" -> {'value': 1.5} (50-offset, with space and .5 step)
    """
    if response in ("PSSWL OFF", "PSSWLOFF"):
        return {'state': 'off'}
    if response in ("PSSWL ON", "PSSWLON"):
        # This is an acknowledgement, not a full state update. Return a consistent
        # payload to prevent frontend errors, but the value is unknown from this message.
        return {'state': 'on'}

    # EDITED: Updated regex to handle an optional space and variable-length digits (e.g., "PSSWL54" or "PSSWL 515").
    match = re.match(r'^PSSWL\s?(\d+)$', response)
    if match:
        raw_val_str = match.group(1)
        # Handle 2-digit (e.g., 50) and 3-digit (e.g., 515 for 51.5) values
        value = _parse_value_with_half_step(raw_val_str)
        db_value = value - 50.0
        # FIX: A level response does NOT imply the feature is 'on'.
        # The 'on'/'off' state is handled by a separate response.
        return {'value': db_value}
    return None

def _parse_channel_level(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Parses CV (Channel Volume) responses for individual channels.
    - "CVFL 50" -> ('channel_level_update', {'channel': 'FL', 'value': 0.0})
    - "CVC 605" -> ('channel_level_update', {'channel': 'C', 'value': 10.5})
    - "CVEND"   -> ('channel_level_list_end', {})
    """
    if response == 'CVEND':
        return 'channel_level_list_end', {}

    match = re.match(r'^CV([A-Z]{1,3})\s?(\d+)$', response)
    if match:
        channel, raw_val_str = match.groups()
        # Handle 2-digit (e.g., 50) and 3-digit (e.g., 505 for 50.5) values
        value = _parse_value_with_half_step(raw_val_str)
        # The scale is always centered at 50 for 0dB, regardless of the range.
        db_value = value - 50.0
        return 'channel_level_update', {'channel': channel, 'value': db_value}
    return None

# Create a parser for Power status using the factory
_parse_power = _create_on_off_parser('PW', 'ON', 'STANDBY')

def _parse_input_source(response: str) -> Optional[Dict[str, Any]]:
    """
    Parses SI (Source Input) responses.
    - "SITV" -> {'source': 'TV'}
    """
    if response.startswith('SI'):
        return {'source': response[2:]}
    return None

# --- Master Parser Dispatch Table ---
# This table maps response prefixes to their dedicated parser functions.
# The order is important: more specific prefixes must come before less specific ones
# (e.g., 'MVMAX' before 'MV', 'MSSMART' before 'MS').
PARSER_CONFIG = [
    # Prefix, Parser Function, Event Name (or None if parser returns the full tuple)
    ('MVMAX', _parse_volume, None),
    ('MV', _parse_volume, None),
    ('MU', _parse_mute, 'mute_update'),
    ('PSDIL', _parse_dialog_level, 'dialog_level_update'),
    ('PSMDAX', _parse_mdax, 'mdax_update'),
    ('PSCINEQ', _parse_cinema_eq, 'cinema_eq_update'),
    ('PSDYNEQ', _parse_dynamic_eq, 'dynamic_eq_update'),
    ('PSDYNVOL', _parse_dynamic_volume, 'dynamic_volume_update'),
    ('PV', _parse_picture_mode, 'picture_mode_update'),
    ('PW', _parse_power, 'power_update'),
    ('SI', _parse_input_source, 'input_source_update'),
    ('CV', _parse_channel_level, None),
    ('Z2', _parse_zone2, None),
    ('PSREFLEV', _parse_reference_level, 'reference_level_update'),
    ('PSCEG', _parse_center_gain, 'center_gain_update'),
    ('PSSWL', _parse_subwoofer_level_adjust, 'sub_level_adjust_update'),
    ('PSSWR', _parse_subwoofer_status, 'subwoofer_status_update'),
    ('PSGEQ', _parse_graphic_eq, 'graphic_eq_update'),
    ('PSTONE CTRL ', _parse_tone_control, 'tone_control_update'),
    ('PSDRC', _parse_dynamic_range_compression, 'drc_update'),
    ('PSEC', _parse_eco_mode, 'eco_mode_update'),
    ('SYREMOTE LOCK', _parse_system_lock, None),
    ('SYPANEL LOCK', _parse_system_lock, None),
    ('PSDCA', _parse_audyssey_dyn_comp, 'audyssey_dyn_comp_update'),
    ('DC', _parse_digital_control, 'digital_control_update'),
    ('NSEXT', _create_on_off_parser('NSEXT ', 'ON', 'OFF'), 'nse_extended_update'),
    ('NSPAN', _create_multi_state_parser(r'^NSPAN(USN|PAS|OK|NG|LOGIN|LOGOUT)\s?(.*)$'), 'pandora_login_update'),
    ('SSINFAISFSV', _create_multi_state_parser(r'^SSINFAISFSV\s(.*)$'), 'signal_info_update'),
    ('SSVCTZMAPON', _create_multi_state_parser(r'^SSVCTZMAPON\s(.*)$'), 'ssv_map_update'),
    ('SV', _parse_video_select, None),
    ('SD', _parse_sound_detail, 'sound_detail_update'),
    ('TR', _parse_trigger, None),
    ('PSLFE', _create_numeric_parser('PSLFE'), 'lfe_level_update'),
    ('PSBAS', _create_numeric_parser('PSBAS'), 'bass_level_update'),
    ('PSTRE', _create_numeric_parser('PSTRE'), 'treble_level_update'),
    ('PSMODE', _create_multi_state_parser(r'^PSMODE:(.*)$'), 'parameter_mode_update'),
    ('SSSMG', _create_multi_state_parser(r'^SSSMG\s(.*)$'), 'sound_submode_update'),
    ('ZMON', lambda r: {'state': 'on'}, 'main_zone_power_update'),
    ('ZMOFF', lambda r: {'state': 'off'}, 'main_zone_power_update'),
    ('SLP', _parse_sleep_timer, 'sleep_timer_update'),
    ('TM', _parse_tuner_status, None),
    ('TF', _parse_tuner_status, None),
    ('TP', _parse_tuner_status, None),
    ('MSSMART', _parse_smart_select, 'smart_select_update'),
    ('MS', _parse_sound_mode, 'sound_mode_update'),
    ('NSF ', _parse_play_state, 'play_state_update'),
    ('CRPLYSTS ', _parse_play_state, 'play_state_update'),
    # The 'NSE' parser is now handled separately by giving the OsdParser priority.
    # ('NSE', _osd_parser.parse, None),
]

def parse_response(response: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Master parsing function. It routes a raw response string to the correct sub-parser
    using a dispatch table for clarity and maintainability. It gives special
    priority to the stateful OSD parser.
    """
    # Give the stateful OSD parser the first chance to process the line.
    osd_event = _osd_parser.parse(response)
    if osd_event:
        return osd_event

    # If not an OSD event, try the other parsers in the dispatch table.
    for prefix, parser_func, event_name in PARSER_CONFIG:
        if response.startswith(prefix):
            # Parsers that return the full tuple (event_name, data)
            if event_name is None:
                return parser_func(response)
            # Parsers that return just the data dictionary
            else:
                data = parser_func(response)
                if data:
                    return event_name, data
            # If a prefix matched, we assume it was handled, even if the parser returned None.
            # We stop processing to avoid incorrect matches with less specific prefixes.
            return None
    return None