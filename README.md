# Marantz SR6009 Web Remote

A custom, full-stack web application that serves as a sophisticated remote control for a Marantz SR6009 AV receiver (and likely other similar Denon/Marantz models), accessible from any browser on your local network.

This project was born out of a desire for a more responsive, feature-rich, and visually appealing remote control than the official app, with the ability to run as a simple, standalone server on a home network.

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

This guide is structured to ensure the most stable setup. Following these steps in order is highly recommended.

### Step 1: Improve Network Reliability (DHCP Reservations)

For the most stable and reliable experience, it is **highly recommended** to set up DHCP Reservations for both your Marantz receiver and the computer running this application.

**What it is:** A DHCP Reservation is a setting in your router that tells it to always assign the same IP address to a specific device.

**Why it's important:** Without it, your router might give your receiver or PC a new IP address after a reboot, which would break the connection until you reconfigure the application. This one-time setup prevents that from ever happening.

#### General Steps:

1.  **Find the MAC Address for each device:**
    *   **For the Marantz Receiver:** Go to the on-screen menu and navigate to `Setup` > `Network` > `Information`. Look for the "MAC Address" (it will look like `00:05:CD:XX:XX:XX`).
    *   **For the Windows PC running the server:** Open Command Prompt (`cmd`) and type `ipconfig /all`. Find your main network adapter (e.g., "Ethernet adapter" or "Wireless LAN adapter") and look for the "Physical Address". This is its MAC address.
2.  **Log into your Router:** Open a web browser and go to your router's admin page (commonly `192.168.1.1` or `192.168.0.1`).
3.  **Find the DHCP Reservation Settings:** This is usually located under "LAN Setup", "DHCP Settings", or "Address Reservation". The name varies by router brand.
4.  **Add Reservations:** Use the router's interface to add a new reservation for both the receiver and the PC. You will pair the MAC address you found in Step 1 with the IP address you want it to have permanently (you can use its current IP address).
5.  **Save and Reboot:** Save the settings in your router. Some routers may require a reboot.

Once this is done, the IP addresses for your devices are permanent, and you are ready to install and configure the application.

### Step 2: Choose Your Installation Method

#### Option A: For Users (Recommended)

The easiest way to use the application is with the pre-built executable.

1.  **Download:** Go to the Releases page and download the latest `MarantzRemote.exe` file.
2.  **Run:** Double-click `MarantzRemote.exe` to start the server. The first time you run it, it will create a configuration file and then may close. This is normal.
3.  **Configure:**
    -   Navigate to `C:\ProgramData\Marantz SR6009 Remote\` and open the `config.json` file in a text editor (like Notepad).
    -   You will see the following settings:
        ```json
        {
            "receiver_ip": "192.168.1.203",
            "server_host": "0.0.0.0",
            "server_port": 5000,
            "input_names": { ... }
        }
        ```
    -   Change the `receiver_ip` value to the static IP address you reserved for your Marantz receiver in Step 1.
    -   Save the file.
4.  **Run Again:** Double-click `MarantzRemote.exe` again. A console window will appear showing the server status. You can minimize this window.
5.  **Access the Remote:** Open a web browser on any device on your network (computer, phone, tablet) and go to `http://<IP_of_PC_running_the_exe>:5000`. For example, if the computer running the app has the static IP `192.168.1.100`, you would go to `http://192.168.1.100:5000`.

#### Option B: For Developers

If you want to run the application from the source code to modify or contribute to it:

1.  **Prerequisites:**
    -   Python 3.9+
    -   Git

2.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/your-repo.git # Replace with your repo URL
    cd your-repo/Application # Navigate into the application directory
    ```

3.  **Configure (Optional):** The initial default IP addresses are set in `Application/config.py`. You can edit the `MARANTZ_IP` variable (line 11) to match the static IP you reserved for your receiver.

4.  **Run:** The easiest way to run from source is to use the provided batch script. Simply double-click `run.bat`. It will automatically create a virtual environment and install dependencies if it's the first time, then start the server.

5.  **Access the Remote:** Open your browser and go to `http://127.0.0.1:5000`.

## Building the Executable

To bundle the application into a single `.exe` file for distribution, `PyInstaller` is used.

1.  Make sure you have followed the developer setup and installed all dependencies.
2.  Ensure PyInstaller is installed: `pip install pyinstaller`
3.  Navigate to the `Application` directory.
4.  Run the build command using the provided spec file:
    ```bash
    pyinstaller MarantzRemote.spec
    ```
5.  The final `MarantzRemote.exe` will be located in the `dist/MarantzRemote` folder.

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
|-- requirements.txt
```
