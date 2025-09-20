import asyncio
import atexit
import logging
import threading
from typing import Coroutine, Any, Callable
from concurrent.futures import TimeoutError, Future

# --- Import project-specific modules ---
from config import TELNET_OPERATION_TIMEOUT, RECONNECT_DELAY_SECONDS, KEEP_ALIVE_INTERVAL_SECONDS

# --- Logging Setup ---
logger = logging.getLogger(__name__)

# --- Constants ---
COMMAND_SEND_DELAY = 0.1  # Small delay after sending a command to prevent flooding the receiver.
KEEP_ALIVE_COMMAND = "PW?"  # A safe, non-intrusive command to keep the connection alive.
SHUTDOWN_TIMEOUT_SECONDS = 5  # Timeout for graceful shutdown operations.


# --- Telnet Client Class ---
class MarantzTelnetClient:
    """
    Manages a persistent, thread-safe Telnet connection to the Marantz receiver
    using asyncio for modern, non-blocking I/O, wrapped for a threaded environment.
    """
    def __init__(self, host: str, port: int, data_callback: Callable[[bytes], None], connection_lost_callback: Callable[[], None], connection_established_callback: Callable[[], None]):
        """
        Initializes the client.
        :param host: The IP address of the receiver.
        :param port: The Telnet port of the receiver.
        :param data_callback: A function to call with raw bytes received from the receiver.
        :param connection_lost_callback: A function to call when the connection is lost and a reconnect is being attempted.
        :param connection_established_callback: A function to call when a connection is successfully established.
        """
        self.host: str = host
        self.port: int = port
        self.data_callback = data_callback
        self.connection_lost_callback = connection_lost_callback
        self.connection_established_callback = connection_established_callback
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._lock: threading.Lock = threading.Lock()  # Lock for thread-safe access from other threads
        self._running: bool = True  # Flag to control the asyncio loop's execution
        self._main_task: Future | None = None  # Store the long-running main task
        self._keep_alive_task: asyncio.Task | None = None # Store the keep-alive task

        # Set up and run the asyncio event loop in a background thread, with an explicit type hint.
        self._loop: asyncio.AbstractEventLoop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop_forever, daemon=True)

        # Ensure the loop and connection are closed on exit
        atexit.register(self.close)

    def __repr__(self) -> str:
        """Provides a developer-friendly representation of the client."""
        status = "connected" if self.is_connected() else "disconnected"
        return f"<MarantzTelnetClient host={self.host}:{self.port} status={status}>"

    def start(self):
        """Starts the background thread that runs the asyncio event loop."""
        if not self._thread.is_alive():
            logger.info("Starting Telnet client background thread.")
            # Start the thread first, which starts the event loop.
            self._thread.start()
            # Now that the loop is running, safely schedule the main task.
            self._main_task = asyncio.run_coroutine_threadsafe(self._manage_connection_and_listen(), self._loop)

    def _run_loop_forever(self):
        """Runs the asyncio event loop indefinitely."""
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_forever()
        finally:
            self._loop.close()
            logger.info("Asyncio loop closed.")

    async def _connect(self) -> bool:
        """Establishes a single connection to the receiver. Returns True on success."""
        try:
            # Ensure any previous connection is closed before creating a new one.
            if self._writer:
                self._writer.close()
                await self._writer.wait_closed()

            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port), timeout=TELNET_OPERATION_TIMEOUT
            )
            logger.info(f"Successfully established connection to {self.host}:{self.port}.")
            # Notify the application layer that the connection is ready.
            if self.connection_established_callback:
                self.connection_established_callback()
            # Start the keep-alive task upon successful connection
            if self._keep_alive_task is None or self._keep_alive_task.done():
                self._keep_alive_task = self._loop.create_task(self._send_keep_alive())
            return True
        except Exception as e:
            logger.warning("Connection attempt failed: %s", e)
            # Ensure streams are None if connection fails
            self._reader = None
            self._writer = None
            return False

    async def _send_command_async(self, command: str) -> None:
        """Asynchronously sends a command."""
        if not self._writer:
            logger.warning("Attempted to send command '%s' but client is not connected.", command)
            raise ConnectionError("Not connected to the receiver.")

        try:
            command_bytes = (command + "\r").encode('ascii')
            self._writer.write(command_bytes)
            await self._writer.drain()
            await asyncio.sleep(COMMAND_SEND_DELAY) # A small delay can help prevent command flooding
            logger.debug("Telnet command '%s' sent.", command)
        except Exception as e:
            logger.error("Error sending Telnet command '%s': %s", command, e, exc_info=True)
            # Re-raise to be handled by the caller or let the listener detect the broken pipe.
            raise

    async def _send_keep_alive(self):
        """Periodically sends a harmless query to keep the connection alive."""
        while self._running and self._writer:
            try:
                await asyncio.sleep(KEEP_ALIVE_INTERVAL_SECONDS)
                # This is a safe command that just asks for the power status.
                # We don't need the response, just the act of sending data.
                logger.debug(f"Sending keep-alive query ({KEEP_ALIVE_COMMAND}) to receiver.")
                await self._send_command_async(KEEP_ALIVE_COMMAND)
            except asyncio.CancelledError:
                logger.info("Keep-alive task cancelled.")
                break
            except Exception as e:
                logger.warning(f"Error during keep-alive: {e}. Connection may be lost.")
                break # Exit loop, the main manager will handle reconnecting.

    async def _manage_connection_and_listen(self):
        """
        The main background task. It ensures the client is always connected
        and listening for updates. It will automatically try to reconnect if
        the connection is lost.
        """
        # Buffer to hold incomplete lines from the receiver.
        # This handles cases where the receiver sends fragmented messages (e.g., NSE6\r then Text\r).
        self._line_buffer = b""

        while self._running:
            # Attempt to connect. If it fails, it will return False.
            is_connected = await self._connect()

            if is_connected:
                # Reset the buffer on a new connection.
                self._line_buffer = b""
                # If connection is successful, start listening for updates.
                # This call will block until the connection is lost.
                await self._listen_for_updates()

            # If the loop continues, it means the connection was lost.
            # Wait before attempting to reconnect to avoid spamming.
            if self._running:
                # Use the callback to notify the application layer that the connection was lost.
                self.connection_lost_callback()
                logger.info(f"Connection lost. Attempting to reconnect in {RECONNECT_DELAY_SECONDS} seconds...")
                await asyncio.sleep(RECONNECT_DELAY_SECONDS)

    async def _listen_for_updates(self) -> None:
        """
        Reads from the receiver until the connection is lost.
        It parses known status updates and emits structured events to the
        frontend via Socket.IO.
        """
        logger.info("Listener is active and waiting for receiver updates.")
        try:
            while self._running and self._reader and not self._reader.at_eof():
                try:
                    # Read a chunk of data, not necessarily a full line.
                    chunk = await self._reader.read(1024)
                    if not chunk:
                        # An empty chunk means the connection was closed by the peer.
                        logger.warning("Connection closed by receiver (read empty chunk).")
                        break

                    self._line_buffer += chunk
                    # Process the buffer line by line.
                    while b'\r' in self._line_buffer:
                        line, self._line_buffer = self._line_buffer.split(b'\r', 1)
                        if line:
                            logger.debug("Received raw line from receiver: %r", line)
                            # Pass the complete, reconstructed line to the handler.
                            self.data_callback(line + b'\r') # Add back the delimiter for the parser

                except asyncio.IncompleteReadError:
                    logger.warning("Connection lost while listening for updates. Breaking listener loop.")
                    await self._close_async()
                    break
                except asyncio.CancelledError:
                    logger.info("Listener task cancelled.")
                    break
                except Exception as e:
                    logger.error("An unexpected error occurred in the listener loop: %s", e, exc_info=True)
                    await self._close_async()
                    break
        finally:
            logger.info("Background listener for Marantz updates stopped.")
    
    async def _close_async(self) -> None:
        """Asynchronously closes the Telnet connection."""
        # Cancel the keep-alive task if it's running
        if self._keep_alive_task and not self._keep_alive_task.done():
            self._keep_alive_task.cancel()

        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
                logger.info("Marantz Telnet connection closed asynchronously.")
            except Exception as e:
                logger.error("Error during async socket close: %s", e, exc_info=True)
            finally:
                self._reader = None
                self._writer = None

    def close(self) -> None:
        """
        Thread-safe method to close the Telnet connection and stop the asyncio loop.
        """
        with self._lock:
            if not self._running:
                return
            self._running = False
            logger.info("Initiating graceful shutdown of MarantzTelnetClient...")
            if self._loop.is_running():
                future = asyncio.run_coroutine_threadsafe(self._close_async(), self._loop)
                try:
                    future.result(timeout=SHUTDOWN_TIMEOUT_SECONDS)
                except Exception as e:
                    logger.error("Error during async shutdown: %s", e, exc_info=True)
                self._loop.call_soon_threadsafe(self._loop.stop)
                logger.info("Asyncio loop stop requested.")
            self._thread.join(timeout=SHUTDOWN_TIMEOUT_SECONDS)
            if self._thread.is_alive():
                logger.warning("Background thread did not terminate.")
            else:
                logger.info("Background thread terminated successfully.")
            logger.info("MarantzTelnetClient shutdown complete.")

    def is_connected(self) -> bool:
        """Thread-safe check if the client is currently connected."""
        return self._writer is not None and not self._writer.is_closing()

    def send_command(self, command: str) -> tuple[bool, str, str]:
        """Thread-safe method to send a command."""
        with self._lock:
            if not self._running:
                return False, "Client is shutting down.", ""

            future = asyncio.run_coroutine_threadsafe(self._send_command_async(command), self._loop)
            try:
                future.result(TELNET_OPERATION_TIMEOUT)
                return True, "Command sent successfully.", ""
            except TimeoutError:
                logger.warning("Command '%s' timed out after %s seconds.", command, TELNET_OPERATION_TIMEOUT)
                return False, f"Operation '{command}' timed out.", ""
            except Exception as e:
                logger.error("Error sending command '%s' from thread: %s", command, e, exc_info=True)
                return False, f"Internal error sending '{command}': {e}", ""

    def send_command_fire_and_forget(self, command: str) -> None:
        """
        Thread-safe method to send a command without waiting for a result.
        This is ideal for query groups where the response is handled by the listener.
        """
        with self._lock:
            if self._running:
                asyncio.run_coroutine_threadsafe(self._send_command_async(command), self._loop)