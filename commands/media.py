# commands/media.py

NAVIGATION_COMMANDS = {
    # --- OSD Navigation / Cursor ---
    'CURSOR_UP': {'code': 'MNCUP', 'type': 'action', 'description': 'Navigates cursor up.'},
    'CURSOR_DOWN': {'code': 'MNCDN', 'type': 'action', 'description': 'Navigates cursor down.'},
    'CURSOR_LEFT': {'code': 'MNCLT', 'type': 'action', 'description': 'Navigates cursor left.'},
    'CURSOR_RIGHT': {'code': 'MNCRT', 'type': 'action', 'description': 'Navigates cursor right.'},
    'CURSOR_ENTER': {'code': 'MNENT', 'type': 'action', 'description': 'Selects the current item (Enter).'},
    # --- Menu Controls ---
    'MENU_SETUP_ON': {'code': 'MNMEN ON', 'type': 'action', 'description': 'Turns the setup menu on.'},
    'MENU_SETUP_OFF': {'code': 'MNMEN OFF', 'type': 'action', 'description': 'Turns the setup menu off.'},
    'MENU_BACK': {'code': 'MNRTN', 'type': 'action', 'description': 'Goes back in the menu.'},
    'MENU_INFO': {'code': 'MNINF', 'type': 'action', 'description': 'Shows the info screen.'},
    'MENU_OPTION': {'code': 'MNOPT', 'type': 'action', 'description': 'Shows the option menu.'},
}

PLAYBACK_COMMANDS = {
    # --- Playback Controls ---
    'PLAY_PAUSE_TOGGLE': {'code': 'NS94', 'type': 'action', 'description': 'Toggles Play/Pause for network sources. (Official: Enter)'},
    'PLAY_NEXT': {'code': 'NS9D', 'type': 'action', 'description': 'Skips to the next track. (Official: Skip Plus)'},
    'PLAY_PREVIOUS': {'code': 'NS9E', 'type': 'action', 'description': 'Goes to the previous track. (Official: Skip Minus)'},
    'PANDORA_PLAY_PAUSE_TOGGLE': {'code': 'NS9A', 'type': 'action', 'description': 'Toggles Play/Pause for Pandora (based on observation).'},
    # NEW: The "Purple Monkey Dishwasher" command. Sends NSE to force a full screen update.
    'NOW_PLAYING_FORCE_QUERY': {'code': 'NSE', 'type': 'query', 'description': 'Forces a full "Now Playing" screen update by sending an undocumented command.'},
    'FAVORITES_ADD': {
        'type': 'macro',
        'description': 'Adds the currently playing station to favorites via a menu macro.',
        'commands': [
            'MENU_OPTION', 'CURSOR_ENTER'
        ]
    },
}