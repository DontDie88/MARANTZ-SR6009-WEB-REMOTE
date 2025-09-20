# commands/system.py

SLEEP_TIMER_COMMANDS = {
    # --- Sleep Timer ---
    'SLEEP_SET': {'code': 'SLP{value}', 'type': 'setter', 'description': 'Sets sleep timer in minutes (1-120).', 'value_range': (1, 120), 'value_format': '{:03d}'},
    'SLEEP_OFF': {'code': 'SLPOFF', 'type': 'action', 'description': 'Turns the sleep timer off.'},
}

_picture_modes = {
    'STANDARD': 'STD',
    'MOVIE': 'MOV',
    'VIVID': 'VVD',
    'STREAM': 'STM',
    'CUSTOM': 'CTM',
    'ISF_DAY': 'DAY',
    'ISF_NIGHT': 'NGT',
}

VIDEO_COMMANDS = {
    # --- Video Settings ---
    'PICTURE_MODE_OFF': {'code': 'PVOFF', 'type': 'action', 'description': 'Turns Picture Mode off.'},
    **{f'PICTURE_MODE_{name}': {
        'code': f'PV{code}', 'type': 'action', 'description': f'Sets Picture Mode to {name.replace("_", " ").title()}.'
    } for name, code in _picture_modes.items()},
    'PICTURE_MODE_QUERY': {'code': 'PV?', 'type': 'query', 'description': 'Queries the current Picture Mode.'},
    'DNR_OFF': {'code': 'PVDNR OFF', 'type': 'action', 'description': 'Turns Dynamic Noise Reduction off.'},
    'DNR_LOW': {'code': 'PVDNR LOW', 'type': 'action', 'description': 'Sets Dynamic Noise Reduction to Low.'},
    'DNR_MID': {'code': 'PVDNR MID', 'type': 'action', 'description': 'Sets Dynamic Noise Reduction to Mid.'},
    'DNR_HIGH': {'code': 'PVDNR HI', 'type': 'action', 'description': 'Sets Dynamic Noise Reduction to High.'},
}

SYSTEM_UTILITY_COMMANDS = {
    # --- System Utilities ---
    'SYSTEM_REMOTE_LOCK_ON': {'code': 'SYREMOTE LOCK ON', 'type': 'action', 'description': 'Locks the remote.'},
    'SYSTEM_REMOTE_LOCK_OFF': {'code': 'SYREMOTE LOCK OFF', 'type': 'action', 'description': 'Unlocks the remote.'},
    'SYSTEM_PANEL_LOCK_ON': {'code': 'SYPANEL LOCK ON', 'type': 'action', 'description': 'Locks the front panel.'},
    'SYSTEM_PANEL_LOCK_OFF': {'code': 'SYPANEL LOCK OFF', 'type': 'action', 'description': 'Unlocks the front panel.'},
    'SYSTEM_PANEL_V_LOCK_ON': {'code': 'SYPANEL+V LOCK ON', 'type': 'action', 'description': 'Locks the panel and volume.'},
    'TRIGGER_1_ON': {'code': 'TR1 ON', 'type': 'action', 'description': 'Turns Trigger 1 on.'},
    'TRIGGER_1_OFF': {'code': 'TR1 OFF', 'type': 'action', 'description': 'Turns Trigger 1 off.'},
    'TRIGGER_2_ON': {'code': 'TR2 ON', 'type': 'action', 'description': 'Turns Trigger 2 on.'},
    'TRIGGER_2_OFF': {'code': 'TR2 OFF', 'type': 'action', 'description': 'Turns Trigger 2 off.'},
    'ECO_MODE_QUERY': {'code': 'ECO?', 'type': 'query', 'description': 'Queries the ECO Mode status.'},
    'SYSTEM_REMOTE_LOCK_QUERY': {'code': 'SYREMOTE LOCK?', 'type': 'query', 'description': 'Queries the remote lock status.'},
    'SYSTEM_PANEL_LOCK_QUERY': {'code': 'SYPANEL LOCK?', 'type': 'query', 'description': 'Queries the panel lock status.'},
    # NEW: Add missing ECO mode commands to match the UI.
    'ECO_MODE_ON': {'code': 'ECOON', 'type': 'action', 'description': 'Turns ECO mode on.'},
    'ECO_MODE_AUTO': {'code': 'ECOAUTO', 'type': 'action', 'description': 'Sets ECO mode to Auto.'},
    'ECO_MODE_OFF': {'code': 'ECOOFF', 'type': 'action', 'description': 'Turns ECO mode off.'},
    # --- Miscellaneous ---
    'MAIN_ZONE_ON': {'code': 'ZMON', 'type': 'action', 'description': 'Turns the main zone on.'},
}