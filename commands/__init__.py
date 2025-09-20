# c:/Users/SC/Desktop/Marantz SR6009 Remote/commands/__init__.py
"""
This file serves as the central hub for the 'commands' package.
It imports all the command dictionaries from the individual modules
and merges them into a single, comprehensive COMMAND_MAP for the application.
"""

# Import command dictionaries from the modularized files.
from .audio import AUDIO_PARAM_COMMANDS
from .inputs import INPUT_COMMANDS
from .main import POWER_COMMANDS, VOLUME_COMMANDS, MUTE_COMMANDS
from .media import NAVIGATION_COMMANDS, PLAYBACK_COMMANDS
from .sound import SOUND_MODE_COMMANDS, SMART_SELECT_COMMANDS
from .system import SLEEP_TIMER_COMMANDS, VIDEO_COMMANDS, SYSTEM_UTILITY_COMMANDS
from .tuner import TUNER_COMMANDS
from .zone2 import ZONE2_COMMANDS

# Define special command groups that reference other commands.
QUERY_GROUP_COMMANDS = {
    # --- Query Groups (for efficiency) ---
    'INITIAL_STATUS_QUERY': {
        'type': 'query_group',
        'description': 'Queries all essential statuses on page load with a single API call to prevent request storms.',
        'commands': [
            'POWER_QUERY',
            'VOLUME_QUERY',
            'MUTE_QUERY',
            'INPUT_QUERY',
            'SOUND_MODE_QUERY',
            'DIALOG_LEVEL_QUERY',
            'CHANNEL_LEVELS_QUERY',
            'DYNAMIC_EQ_QUERY',
            'REF_LVL_QUERY',
            'ZONE2_MUTE_QUERY',
            'MDAX_QUERY',
            'CINEMA_EQ_QUERY',
            'DYNAMIC_VOLUME_QUERY',
            'PICTURE_MODE_QUERY',
            'GRAPHIC_EQ_QUERY',
            'TONE_CONTROL_QUERY',
            'DYNAMIC_RANGE_COMPRESSION_QUERY',
            'ECO_MODE_QUERY',
            'SUB_LEVEL_ADJUST_QUERY',
            'CENTER_GAIN_QUERY',
            'VIDEO_SELECT_QUERY',
            'SUBWOOFER_QUERY',
            'AUDYSSEY_DYN_COMP_QUERY',
            'SYSTEM_REMOTE_LOCK_QUERY',
            'SYSTEM_PANEL_LOCK_QUERY',
        ]
    },
}

# --- Helper function for robust merging ---
def _merge_command_dicts(*dicts):
    """
    Merges multiple command dictionaries into one.
    Raises a KeyError if a duplicate command key is found to prevent silent overwrites.
    """
    merged_map = {}
    for command_dict in dicts:
        for key, value in command_dict.items():
            if key in merged_map:
                raise KeyError(f"Duplicate command key '{key}' found. Command keys must be unique across all files.")
            merged_map[key] = value
    return merged_map

# --- Final Merged Command Map ---
# This combines all the smaller dictionaries into the single COMMAND_MAP used by the application.
# Using the robust merge function to prevent duplicate key collisions.
COMMAND_MAP = _merge_command_dicts(
    POWER_COMMANDS,
    VOLUME_COMMANDS,
    MUTE_COMMANDS,
    INPUT_COMMANDS,
    SOUND_MODE_COMMANDS,
    SMART_SELECT_COMMANDS,
    ZONE2_COMMANDS,
    SLEEP_TIMER_COMMANDS,
    NAVIGATION_COMMANDS,
    PLAYBACK_COMMANDS,
    TUNER_COMMANDS,
    AUDIO_PARAM_COMMANDS,
    VIDEO_COMMANDS,
    SYSTEM_UTILITY_COMMANDS,
    QUERY_GROUP_COMMANDS
)