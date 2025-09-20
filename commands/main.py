# commands/main.py

def format_volume(value_str: str) -> str:
    """
    Custom formatter for volume commands to handle .5dB steps per the spec.
    Example: "50.5" -> "505", "50" -> "50"
    """
    num_value = float(value_str) # type: ignore
    # Check if the fractional part of the number is exactly 0.5
    if num_value - int(num_value) == 0.5:
        # For half-steps, the receiver expects a three-digit string (e.g., 9.5 -> "095", 10.5 -> "105")
        # This fixes a bug where 9.5 was incorrectly formatted as "95" (95.0).
        return f"{int(num_value * 10):03d}"
    else:
        # For whole numbers, format to two digits (e.g., 7 -> "07")
        return f"{int(num_value):02d}"

POWER_COMMANDS = {
    # --- Power ---
    'POWER_ON': {'code': 'PWON', 'type': 'action', 'description': 'Turns the main zone on.'},
    'POWER_STANDBY': {'code': 'PWSTANDBY', 'type': 'action', 'description': 'Puts the main zone in standby.'},
    'POWER_QUERY': {'code': 'PW?', 'type': 'query', 'description': 'Queries the main zone power status.'},
}

VOLUME_COMMANDS = {
    # --- Volume ---
    'VOLUME_SET': {'code': 'MV{value}', 'type': 'setter', 'description': 'Sets main volume to a specific level (0-98), supporting .5 steps.', 'value_range': (0, 98), 'formatter': format_volume},
    'VOLUME_QUERY': {'code': 'MV?', 'type': 'query', 'description': 'Queries the main volume level.'},
}

MUTE_COMMANDS = {
    # --- Mute ---
    'MUTE_ON': {'code': 'MUON', 'type': 'action', 'description': 'Mutes the main zone.'},
    'MUTE_OFF': {'code': 'MUOFF', 'type': 'action', 'description': 'Unmutes the main zone.'},
    'MUTE_QUERY': {'code': 'MU?', 'type': 'query', 'description': 'Queries the main mute status.'},
}