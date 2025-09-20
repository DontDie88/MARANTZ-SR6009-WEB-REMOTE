# commands/audio.py

def format_dialog_level(value_str: str) -> str:
    """
    Custom formatter for dialog level to handle .5 steps.
    The receiver expects '38' for -12dB and '385' for -11.5dB.
    Example: "38.5" -> "385", "39" -> "39"
    """
    num_value = float(value_str)
    # Check if the value has a .5 decimal part
    if abs(num_value * 10 % 10) == 5:
        return str(int(num_value * 10))
    else:
        # For whole numbers, just return the integer part as a string.
        return str(int(num_value))

def format_center_gain(value_str: str) -> str:
    """
    Custom formatter for Center Gain. The receiver expects a value from 00-10
    to represent a 0.0-1.0 dB scale.
    Example: "0.5" -> "05", "1.0" -> "10"
    """
    num_value = float(value_str)
    # Value is from 0.0 to 1.0. Receiver expects 00 to 10.
    return f"{int(round(num_value * 10)):02d}"

AUDIO_PARAM_COMMANDS = {
    # --- Audio Parameters ---
    'TONE_CONTROL_ON': {'code': 'PSTONE CTRL ON', 'type': 'action', 'description': 'Turns Tone Control on.'},
    'TONE_CONTROL_OFF': {'code': 'PSTONE CTRL OFF', 'type': 'action', 'description': 'Turns Tone Control off.'},
    'TONE_CONTROL_QUERY': {'code': 'PSTONE CTRL ?', 'type': 'query', 'description': 'Queries Tone Control status.'},
    'CENTER_GAIN_UP': {'code': 'PSCEG UP', 'type': 'action', 'description': 'Increases center gain.'},
    'CENTER_GAIN_DOWN': {'code': 'PSCEG DOWN', 'type': 'action', 'description': 'Decreases center gain.'},
    'CENTER_GAIN_SET': {'code': 'PSCEG{value}', 'type': 'setter', 'description': 'Sets center gain (0.0 to 1.0 dB).', 'value_range': (0, 1.0), 'formatter': format_center_gain},
    'CENTER_GAIN_QUERY': {'code': 'PSCEG ?', 'type': 'query', 'description': 'Queries the Center Gain value.'},
    'CHANNEL_LEVELS_QUERY': {'code': 'CV?', 'type': 'query', 'description': 'Queries all channel levels.'},
    'CHANNEL_VOLUME_RESET': {'code': 'CVZRL', 'type': 'action', 'description': 'Resets all channel volumes to 0dB.'},
    'SET_LEVEL_FL': {'code': 'CVFL {value}', 'type': 'setter', 'description': 'Sets Front Left channel level.'},
    'SET_LEVEL_FR': {'code': 'CVFR {value}', 'type': 'setter', 'description': 'Sets Front Right channel level.'},
    'SET_LEVEL_C': {'code': 'CVC {value}', 'type': 'setter', 'description': 'Sets Center channel level.'},
    'SET_LEVEL_SW': {'code': 'CVSW {value}', 'type': 'setter', 'description': 'Sets Subwoofer channel level.'},
    'SET_LEVEL_SL': {'code': 'CVSL {value}', 'type': 'setter', 'description': 'Sets Surround Left channel level.'},
    'SET_LEVEL_SR': {'code': 'CVSR {value}', 'type': 'setter', 'description': 'Sets Surround Right channel level.'},
    'SET_LEVEL_SBL': {'code': 'CVSBL {value}', 'type': 'setter', 'description': 'Sets Surround Back Left channel level.'},
    'SET_LEVEL_SBR': {'code': 'CVSBR {value}', 'type': 'setter', 'description': 'Sets Surround Back Right channel level.'},
    'SET_LEVEL_SB': {'code': 'CVSB {value}', 'type': 'setter', 'description': 'Sets Surround Back channel level.'},
    'SET_LEVEL_FHL': {'code': 'CVFHL {value}', 'type': 'setter', 'description': 'Sets Front Height Left channel level.'},
    'SET_LEVEL_FHR': {'code': 'CVFHR {value}', 'type': 'setter', 'description': 'Sets Front Height Right channel level.'},
    'SET_LEVEL_FWL': {'code': 'CVFWL {value}', 'type': 'setter', 'description': 'Sets Front Wide Left channel level.'},
    'SET_LEVEL_FWR': {'code': 'CVFWR {value}', 'type': 'setter', 'description': 'Sets Front Wide Right channel level.'},
    'REF_LVL_SET': {'code': 'PSREFLEV {value}', 'type': 'setter', 'description': 'Sets the Reference Level Offset (0, 5, 10, 15).'},
    'REF_LVL_QUERY': {'code': 'PSREFLEV ?', 'type': 'query', 'description': 'Queries the current Reference Level Offset.'},
    'DIALOG_LEVEL_ADJUST_ON': {'code': 'PSDIL ON', 'type': 'action', 'description': 'Turns Dialog Level Adjust on.'},
    'DIALOG_LEVEL_ADJUST_OFF': {'code': 'PSDIL OFF', 'type': 'action', 'description': 'Turns Dialog Level Adjust off.'},
    'DIALOG_LEVEL_UP': {'code': 'PSDIL UP', 'type': 'action', 'description': 'Increases dialog level.'},
    'DIALOG_LEVEL_DOWN': {'code': 'PSDIL DOWN', 'type': 'action', 'description': 'Decreases dialog level.'},
    'DIALOG_LEVEL_SET': {'code': 'PSDIL {value}', 'type': 'setter', 'description': 'Sets dialog level (-12dB to +12dB).', 'value_range': (38, 62), 'formatter': format_dialog_level},
    'DIALOG_LEVEL_QUERY': {'code': 'PSDIL ?', 'type': 'query', 'description': 'Queries the Dialog Level Adjust status and value.'},
    'SUB_LEVEL_ADJUST_ON': {'code': 'PSSWL ON', 'type': 'action', 'description': 'Enables the Subwoofer Level Adjust feature.'},
    'SUB_LEVEL_ADJUST_OFF': {'code': 'PSSWL OFF', 'type': 'action', 'description': 'Disables (bypasses) the Subwoofer Level Adjust feature.'},
    'SUB_LEVEL_ADJUST_UP': {'code': 'PSSWL UP', 'type': 'action', 'description': 'Increases the Subwoofer Level Adjust value.'},
    'SUB_LEVEL_ADJUST_DOWN': {'code': 'PSSWL DOWN', 'type': 'action', 'description': 'Decreases the Subwoofer Level Adjust value.'},
    'SUB_LEVEL_ADJUST_QUERY': {'code': 'PSSWL ?', 'type': 'query', 'description': 'Queries the Subwoofer Level Adjust status and value.'},
    'SUBWOOFER_ON': {'code': 'PSSWR ON', 'type': 'action', 'description': 'Turns the subwoofer on (in speaker config).'},
    'SUBWOOFER_OFF': {'code': 'PSSWR OFF', 'type': 'action', 'description': 'Turns the subwoofer off (in speaker config).'},
    'SUBWOOFER_QUERY': {'code': 'PSSWR ?', 'type': 'query', 'description': 'Queries the subwoofer on/off status.'},
    'MDAX_OFF': {'code': 'PSMDAX OFF', 'type': 'action', 'description': 'Sets M-DAX to Off.'},
    'MDAX_LOW': {'code': 'PSMDAX LOW', 'type': 'action', 'description': 'Sets M-DAX to Low.'},
    'MDAX_MEDIUM': {'code': 'PSMDAX MED', 'type': 'action', 'description': 'Sets M-DAX to Medium.'},
    'MDAX_HIGH': {'code': 'PSMDAX HI', 'type': 'action', 'description': 'Sets M-DAX to High.'},
    'MDAX_QUERY': {'code': 'PSMDAX?', 'type': 'query', 'description': 'Queries the M-DAX status.'},
    'CINEMA_EQ_ON': {'code': 'PSCINEQ ON', 'type': 'action', 'description': 'Turns Cinema EQ on.'},
    'CINEMA_EQ_OFF': {'code': 'PSCINEQ OFF', 'type': 'action', 'description': 'Turns Cinema EQ off.'},
    'CINEMA_EQ_QUERY': {'code': 'PSCINEQ?', 'type': 'query', 'description': 'Queries the Cinema EQ status.'},
    'DYNAMIC_EQ_ON': {'code': 'PSDYNEQ ON', 'type': 'action', 'description': 'Turns Dynamic EQ on.'},
    'DYNAMIC_EQ_OFF': {'code': 'PSDYNEQ OFF', 'type': 'action', 'description': 'Turns Dynamic EQ off.'},
    'DYNAMIC_EQ_QUERY': {'code': 'PSDYNEQ?', 'type': 'query', 'description': 'Queries Dynamic EQ status.'},
    'DYNAMIC_VOLUME_OFF': {'code': 'PSDYNVOL OFF', 'type': 'action', 'description': 'Sets Dynamic Volume to Off.'},
    'DYNAMIC_VOLUME_LIGHT': {'code': 'PSDYNVOL LIT', 'type': 'action', 'description': 'Sets Dynamic Volume to Light.'},
    'DYNAMIC_VOLUME_MEDIUM': {'code': 'PSDYNVOL MED', 'type': 'action', 'description': 'Sets Dynamic Volume to Medium.'},
    'DYNAMIC_VOLUME_HEAVY': {'code': 'PSDYNVOL HEV', 'type': 'action', 'description': 'Sets Dynamic Volume to Heavy.'},
    'DYNAMIC_VOLUME_QUERY': {'code': 'PSDYNVOL?', 'type': 'query', 'description': 'Queries the Dynamic Volume status.'},
    'GRAPHIC_EQ_ON': {'code': 'PSGEQ ON', 'type': 'action', 'description': 'Turns Graphic EQ on.'},
    'GRAPHIC_EQ_OFF': {'code': 'PSGEQ OFF', 'type': 'action', 'description': 'Turns Graphic EQ off.'},
    'GRAPHIC_EQ_QUERY': {'code': 'PSGEQ?', 'type': 'query', 'description': 'Queries the Graphic EQ status.'},
    'DYNAMIC_RANGE_COMPRESSION_OFF': {'code': 'PSDRC OFF', 'type': 'action', 'description': 'Turns Dynamic Range Compression off.'},
    'DYNAMIC_RANGE_COMPRESSION_LOW': {'code': 'PSDRC LOW', 'type': 'action', 'description': 'Sets Dynamic Range Compression to Low.'},
    'DYNAMIC_RANGE_COMPRESSION_MEDIUM': {'code': 'PSDRC MID', 'type': 'action', 'description': 'Sets Dynamic Range Compression to Medium.'},
    'DYNAMIC_RANGE_COMPRESSION_HIGH': {'code': 'PSDRC HI', 'type': 'action', 'description': 'Sets Dynamic Range Compression to High.'},
    'DYNAMIC_RANGE_COMPRESSION_QUERY': {'code': 'PSDRC?', 'type': 'query', 'description': 'Queries the Dynamic Range Compression status.'},
    'VIDEO_SELECT_ON': {'code': 'SVON', 'type': 'action', 'description': 'Turns on Video Select mode.'},
    'VIDEO_SELECT_OFF': {'code': 'SVOFF', 'type': 'action', 'description': 'Turns off Video Select mode.'},
    'VIDEO_SELECT_QUERY': {'code': 'SV?', 'type': 'query', 'description': 'Queries the Video Select status.'},
    'VIDEO_SELECT_DVD': {'code': 'SVDVD', 'type': 'action', 'description': 'Sets Video Select source to DVD.'},
    'VIDEO_SELECT_BD': {'code': 'SVBD', 'type': 'action', 'description': 'Sets Video Select source to Blu-ray.'},
    'VIDEO_SELECT_TV': {'code': 'SVTV', 'type': 'action', 'description': 'Sets Video Select source to TV.'},
    'VIDEO_SELECT_SAT_CBL': {'code': 'SVSAT/CBL', 'type': 'action', 'description': 'Sets Video Select source to CBL/SAT.'},
    'VIDEO_SELECT_MPLAY': {'code': 'SVMPLAY', 'type': 'action', 'description': 'Sets Video Select source to Media Player.'},
    'VIDEO_SELECT_GAME': {'code': 'SVGAME', 'type': 'action', 'description': 'Sets Video Select source to Game.'},
    'VIDEO_SELECT_AUX1': {'code': 'SVAUX1', 'type': 'action', 'description': 'Sets Video Select source to AUX1.'},
    'VIDEO_SELECT_AUX2': {'code': 'SVAUX2', 'type': 'action', 'description': 'Sets Video Select source to AUX2.'},
    'VIDEO_SELECT_CD': {'code': 'SVCD', 'type': 'action', 'description': 'Sets Video Select source to CD.'},
    'VIDEO_SELECT_SOURCE': {'code': 'SVSOURCE', 'type': 'action', 'description': 'Sets Video Select source to the last used source.'},
    'AUDYSSEY_DYN_COMP_AUTO': {'code': 'PSDCAUTO', 'type': 'action', 'description': 'Sets Audyssey Dynamic Compression to Auto.'},
    'AUDYSSEY_DYN_COMP_OFF': {'code': 'PSDCAOFF', 'type': 'action', 'description': 'Turns Audyssey Dynamic Compression off.'},
    'AUDYSSEY_DYN_COMP_QUERY': {'code': 'PSDCA?', 'type': 'query', 'description': 'Queries the Audyssey Dynamic Compression status.'},
}