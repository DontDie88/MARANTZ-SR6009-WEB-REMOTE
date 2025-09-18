# MARANTZ-SR6009-WEB-REMOTE
This is a program for a fully functional web remote that may work on other Marantz receivers from around 2014, but is specifically geared for the Marantz SR6009 receiver- A custom, full-stack web application that serves as a sophisticated remote control for a Marantz SR6009 AV receiver (and likely other similar Denon/Marantz models), accessible from any browser on your local network.

This project is a custom, full-stack web application that serves as a sophisticated remote control specifically made for a 2014 Marantz SR6009 AV receiver.

At its core, it's a Python server built with the Flask framework. This server runs a persistent, asynchronous Telnet client in the background, which connects to the receiver over the local network. It sends commands (like PWON for Power On) and listens for status updates from the receiver.

A key component is the protocol parser, which deciphers the receiver's cryptic, non-standard responses (e.g., MV355 or NSE1...) and translates them into structured, meaningful events. The server then uses WebSockets (via Flask-SocketIO) to push these real-time events to any connected web browser.

The frontend is a polished, single-page web interface built with modern HTML, CSS, and JavaScript. It provides a comprehensive set of controls that mirror and extend the physical remote's capabilities, including:

Power, volume, and input selection.
A virtual On-Screen Display (OSD) that mirrors the TV output.
A "Now Playing" view for media sources like Bluetooth or Internet Radio.
Detailed settings for audio, video, and channel levels.
Finally, the project is configured to be bundled into a single, standalone Windows executable using PyInstaller, making it easy for a user to run without needing to install Python or any dependencies. In essence, it's a powerful, user-friendly, and self-contained replacement for the physical remote control, accessible from any web browser on the user's network.



This project was born out of a desire for a more responsive, feature-rich, and visually appealing remote control than the official app, with the ability to run as a simple, standalone server on a home network... and, an immense feeling of boredom! 

 <!-- TODO: Replace with an actual screenshot URL -->

## Features

-   **Real-Time, Two-Way Sync:** The UI reflects the receiver's state in real-time, whether changes are made from the web UI, the physical remote, or the front panel.
-   **Comprehensive Control:** Manage power, volume, mute, input sources, sound modes, and smart selects.
-   **Virtual On-Screen Display (OSD):** A virtual OSD mirrors the receiver's menu on your TV, allowing you to navigate setup and option menus directly from the web interface.
-   **"Now Playing" View:** See detailed track, artist, and album information for network media sources like Bluetooth, Internet Radio, and Pandora.
-   **Advanced Settings:** Fine-tune audio parameters like dialog level, subwoofer level, tone controls, and channel levels.
-   **Customizable Input Names:** Rename inputs to match your setup (e.g., rename "SAT/CBL" to "PC").
-   **Standalone & Portable:** Packaged as a single Windows executable (`.exe`) with no external dependencies required. Just run it and go.
-   **Modern Tech Stack:** Built with a Python/Flask backend, `asyncio` for non-blocking network I/O, and a polished vanilla JavaScript frontend.

## Installation & Usage

### For Users (Recommended)

The easiest way to use the application is with the pre-built executable.

1.  **Download:** Go to the Releases page and download the latest `MarantzRemote.exe` file.
2.  **Run:** Double-click `MarantzRemote.exe` to start the server. A console window will appear showing the server status. You can minimize this window.
3.  **Configure IP Address (First Time Only):**
    -   The first time you run the application, it will create a configuration file at `C:\ProgramData\Marantz SR6009 Remote\config.json`.
    -   Open this `config.json` file in a text editor (like Notepad).
    -   Change the `receiver_ip` value from `"192.168.1.203"` to the actual IP address of your Marantz receiver. You can find this in your receiver's on-screen menu under `Setup > Network > Information`.
    -   Save the file and **restart** `MarantzRemote.exe`.
4.  **Access the Remote:** Open a web browser on any device on your network (computer, phone, tablet) and go to `http://<IP_of_PC_running_the_exe>:5000`. For example, if the computer running the app has an IP of `192.168.1.100`, you would go to `http://192.168.1.100:5000`.

### For Developers

If you want to run the application from the source code to modify or contribute to it:

1.  **Prerequisites:**
    -   Python 3.9+
    -   Git

2.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/your-repo.git
    cd your-repo/Application
    ```

3.  **Set up a Virtual Environment:**
    ```bash
    python -m venv venv
    # On Windows
    venv\Scripts\activate
    # On macOS/Linux
    source venv/bin/activate
    ```

4.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: A `requirements.txt` file should be generated with `pip freeze > requirements.txt`)*

5.  **Configure the IP Address:**
    -   Open the `Application/config.py` file.
    -   Change the `MARANTZ_IP` variable to your receiver's IP address.

6.  **Run the Application:**
    ```bash
    python app.py
    ```

7.  **Access the Remote:** Open your browser and go to `http://127.0.0.1:5000`.

## Building the Executable

To bundle the application into a single `.exe` file for distribution, `PyInstaller` is used.

1.  Make sure you have followed the developer setup and installed all dependencies.
2.  Install PyInstaller: `pip install pyinstaller`
3.  Navigate to the `Application` directory.
4.  Run the build command using the provided spec file:
    ```bash
    pyinstaller MarantzRemote.spec
    ```
5.  The final `MarantzRemote.exe` will be located in the `dist` folder.

## Required Files to Run from Source

To run this program from its source code, you will need the following files and directories from the `Application` folder, maintaining their structure:

```
/Application
|
|-- app.py
|-- config.py
|-- config_manager.py
|-- MarantzRemote.spec
|
|-- api/
|   |-- __init__.py
|   |-- command_handler.py
|
|-- commands/
|   |-- __init__.py
|   |-- audio.py
|   |-- inputs.py
|   |-- main.py
|   |-- media.py
|   |-- sound.py
|   |-- system.py
|   |-- tuner.py
|   |-- zone2.py
|
|-- marantz_remote/
|   |-- __init__.py
|   |-- event_handler.py
|   |-- response_parser.py
|   |-- telnet_client.py
|
|-- static/
|   |-- css/
|   |-- fonts/
|   |-- images/
|   |-- js/
|
|-- templates/
|   |-- index.html
|   |-- (and other .html test files)
|
|-- requirements.txt  <-- You should create this file
```
