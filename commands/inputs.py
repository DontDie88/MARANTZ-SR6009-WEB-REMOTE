# commands/inputs.py

INPUT_COMMANDS = {
    # --- Input Selection ---
    'INPUT_PHONO': {'code': 'SIPHONO', 'type': 'action', 'description': 'Selects the PHONO input.'},
    'INPUT_CD': {'code': 'SICD', 'type': 'action', 'description': 'Selects the CD input.'},
    'INPUT_TUNER': {'code': 'SITUNER', 'type': 'action', 'description': 'Selects the TUNER input.'},
    'INPUT_DVD': {'code': 'SIDVD', 'type': 'action', 'description': 'Selects the DVD input.'},
    'INPUT_BD': {'code': 'SIBD', 'type': 'action', 'description': 'Selects the Blu-ray input.'},
    'INPUT_TV': {'code': 'SITV', 'type': 'action', 'description': 'Selects the TV AUDIO input.'},
    'INPUT_SAT_CBL': {'code': 'SISAT/CBL', 'type': 'action', 'description': 'Selects the SAT/CBL input.'},
    'INPUT_GAME': {'code': 'SIGAME', 'type': 'action', 'description': 'Selects the GAME input.'},
    'INPUT_MPLAY': {'code': 'SIMPLAY', 'type': 'action', 'description': 'Selects the MEDIA PLAYER input.'},
    'INPUT_USB_IPOD': {'code': 'SIUSB/IPOD', 'type': 'action', 'description': 'Selects the iPod/USB input.'},
    'INPUT_BT': {'code': 'SIBT', 'type': 'action', 'description': 'Selects the Bluetooth input.'},
    'INPUT_IRADIO': {'code': 'SIIRADIO', 'type': 'action', 'description': 'Selects the INTERNET RADIO input.'},
    'INPUT_NET': {'code': 'SINET', 'type': 'action', 'description': 'Selects the ONLINE MUSIC input.'},
    'INPUT_PANDORA': {'code': 'SIPANDORA', 'type': 'action', 'description': 'Selects the Pandora input.'},
    'INPUT_FAVORITES': {'code': 'SIFAVORITES', 'type': 'action', 'description': 'Selects the Favorites input.'},
    'INPUT_AUX1': {'code': 'SIAUX1', 'type': 'action', 'description': 'Selects the AUX1 input.'},
    'INPUT_AUX2': {'code': 'SIAUX2', 'type': 'action', 'description': 'Selects the AUX2 input.'},
    'INPUT_QUERY': {'code': 'SI?', 'type': 'query', 'description': 'Queries the current input source.'},
}