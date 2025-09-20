# commands/zone2.py

ZONE2_COMMANDS = {
    # --- Zone 2 Controls ---
    'ZONE2_ON': {'code': 'Z2ON', 'type': 'action', 'description': 'Turns Zone 2 on.'},
    'ZONE2_OFF': {'code': 'Z2OFF', 'type': 'action', 'description': 'Turns Zone 2 off.'},
    'ZONE2_VOLUME_SET': {'code': 'Z2{value}', 'type': 'setter', 'description': 'Sets Zone 2 volume (0-98).', 'value_range': (0, 98), 'value_format': '{:02d}'},
    'ZONE2_MUTE_ON': {'code': 'Z2MUON', 'type': 'action', 'description': 'Mutes Zone 2.'},
    'ZONE2_MUTE_OFF': {'code': 'Z2MUOFF', 'type': 'action', 'description': 'Unmutes Zone 2.'},
    'ZONE2_SOURCE_CD': {'code': 'Z2CD', 'type': 'action', 'description': 'Sets Zone 2 source to CD.'},
    'ZONE2_SOURCE_DVD': {'code': 'Z2DVD', 'type': 'action', 'description': 'Sets Zone 2 source to DVD.'},
    'ZONE2_SOURCE_BLUETOOTH': {'code': 'Z2BT', 'type': 'action', 'description': 'Sets Zone 2 source to Bluetooth.'},
    'ZONE2_SOURCE_TUNER': {'code': 'Z2TUNER', 'type': 'action', 'description': 'Sets Zone 2 source to Tuner.'},
    'ZONE2_SOURCE_FAVORITES': {'code': 'Z2FVP', 'type': 'action', 'description': 'Sets Zone 2 source to Favorites.'},
    'ZONE2_MUTE_QUERY': {'code': 'Z2MU?', 'type': 'query', 'description': 'Queries Zone 2 mute status.'},
}