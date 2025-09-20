# commands/sound.py

SOUND_MODE_COMMANDS = {
    # --- Sound Modes ---
    # Main category selectors (can also cycle)
    'SOUND_MODE_MOVIE': {'code': 'MSMOVIE', 'type': 'action', 'description': 'Selects/cycles the MOVIE sound mode category.'},
    'SOUND_MODE_MUSIC': {'code': 'MSMUSIC', 'type': 'action', 'description': 'Selects/cycles the MUSIC sound mode category.'},
    'SOUND_MODE_GAME': {'code': 'MSGAME', 'type': 'action', 'description': 'Selects/cycles the GAME sound mode category.'},
    # Direct selectors for the two distinct groups
    'SOUND_MODE_DOLBY': {'code': 'MSDOLBY DIGITAL', 'type': 'action', 'description': 'Selects the DOLBY DIGITAL sound mode.'},
    'SOUND_MODE_DTS': {'code': 'MSDTS SURROUND', 'type': 'action', 'description': 'Selects the DTS SURROUND sound mode.'},
    'SOUND_MODE_MCH_STEREO': {'code': 'MSMCH STEREO', 'type': 'action', 'description': 'Selects the MCH STEREO sound mode.'},
    'SOUND_MODE_VIRTUAL': {'code': 'MSVIRTUAL', 'type': 'action', 'description': 'Selects the VIRTUAL sound mode.'},
    'SOUND_MODE_DIRECT': {'code': 'MSDIRECT', 'type': 'action', 'description': 'Selects the DIRECT sound mode.'},
    'SOUND_MODE_PURE_DIRECT': {'code': 'MSPURE DIRECT', 'type': 'action', 'description': 'Selects the PURE DIRECT sound mode.'},
    'SOUND_MODE_STEREO': {'code': 'MSSTEREO', 'type': 'action', 'description': 'Selects the STEREO sound mode.'},
    'SOUND_MODE_AUTO': {'code': 'MSAUTO', 'type': 'action', 'description': 'Selects the AUTO sound mode.'},
    'SOUND_MODE_QUERY': {'code': 'MS?', 'type': 'query', 'description': 'Queries the current sound mode.'},
}

# --- Smart Select ---
SMART_SELECT_COMMANDS = {
    f'SMART_SELECT_{i}': {
        'code': f'MSSMART{i}',
        'type': 'action',
        'description': f'Recalls Smart Select {i}.'
    } for i in range(1, 5)
}