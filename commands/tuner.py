# commands/tuner.py

TUNER_COMMANDS = {
    # --- Tuner Frequency ---
    'TUNER_FREQ_SET_ANALOG': {'code': 'TFAN{value}', 'type': 'setter', 'description': 'Sets analog tuner frequency (e.g., 9850 for 98.5MHz).'},
    'TUNER_FREQ_SET_HD': {'code': 'TFHD{value}', 'type': 'setter', 'description': 'Sets HD tuner frequency.'},
    'TUNER_TUNE_UP': {'code': 'TFANUP', 'type': 'action', 'description': 'Tunes analog frequency up.'},
    'TUNER_TUNE_DOWN': {'code': 'TFANDOWN', 'type': 'action', 'description': 'Tunes analog frequency down.'},
    'TUNER_FREQ_HD_UP': {'code': 'TFHDUP', 'type': 'action', 'description': 'Tunes HD frequency up.'},
    'TUNER_FREQ_HD_DOWN': {'code': 'TFHDDOWN', 'type': 'action', 'description': 'Tunes HD frequency down.'},

    # --- Tuner Mode ---
    'TUNER_MODE_AM': {'code': 'TMANAM', 'type': 'action', 'description': 'Sets tuner mode to AM.'},
    'TUNER_MODE_FM': {'code': 'TMANFM', 'type': 'action', 'description': 'Sets tuner mode to FM.'},
    'TUNER_MODE_AUTO': {'code': 'TMANAUTO', 'type': 'action', 'description': 'Sets tuner mode to Auto (Analog).'},
    'TUNER_MODE_MANUAL': {'code': 'TMANMANUAL', 'type': 'action', 'description': 'Sets tuner mode to Manual (Analog).'},
    'TUNER_MODE_HD_AM': {'code': 'TMHDAM', 'type': 'action', 'description': 'Sets tuner mode to HD AM.'},
    'TUNER_MODE_HD_FM': {'code': 'TMHDFM', 'type': 'action', 'description': 'Sets tuner mode to HD FM.'},
    'TUNER_MODE_HD_AUTO': {'code': 'TMHDAUTOHD', 'type': 'action', 'description': 'Sets tuner mode to HD Auto.'},
    'TUNER_MODE_HD_MANUAL': {'code': 'TMHDMANUAL', 'type': 'action', 'description': 'Sets tuner mode to HD Manual.'},

    # --- Tuner Preset ---
    'TUNER_PRESET_HD_UP': {'code': 'TPHDUP', 'type': 'action', 'description': 'Selects next HD tuner preset.'},
    'TUNER_PRESET_HD_DOWN': {'code': 'TPHDDOWN', 'type': 'action', 'description': 'Selects previous HD tuner preset.'},

    # --- Tuner Query ---
    'TUNER_STATUS_QUERY': {'code': 'TMAN?', 'type': 'query', 'description': 'Queries the current tuner status (band, mode, preset, freq).'},
}