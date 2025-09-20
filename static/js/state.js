/**
 * This module centralizes the application's client-side state.
 * It includes the receiver's status, UI state, and various constants.
 */

// --- Core Receiver State ---
// This object holds the last known state of the receiver.
export const receiverState = {
    main: {
        isPowerOn: null,
        isMuted: null,
        currentInput: null,
        currentVolume: 0,
        isVolumeRamping: false,
        volumeRampTarget: null,
        sleepMinutes: 0,
    },
    zone2: {
        isOn: null,
        isMuted: null,
        currentInput: null,
    },
    audio: {
        referenceLevel: null,
        currentSoundMode: null,
        isSubwooferConfigOn: null,
        // NEW: Tracks the master on/off state of the subwoofer from PSSWR.
        isSubwooferOn: null,
    },
    playback: {
        isPlaying: null,
    },
    ui: {
        selectedChannel: null,
        activeSoundMenu: null,
        osd: {
            isVisible: false,
            autoHideTimeout: null,
            currentTitle: '',
            lineToHighlight: -1,
        },
        nowPlaying: {
            isVisible: false,
        }
    }
};

// --- "Now Playing" State ---
// Holds the state for the currently playing media.
export const currentTrackState = {
    header: '',
    title: '',
    artist: '',
    album: '',
    frequency: '',
    trackInfo: '',
    time: '0:00',
    percent: '0%',
    timestamp: 0
};

// --- UI Interaction State ---
// Manages optimistic UI updates to prevent race conditions.
export const optimisticState = {
    power: { active: false, value: null, timestamp: 0 },
    mute: { active: false, value: null, timestamp: 0 },
    zone2Power: { active: false, value: null, timestamp: 0 },
    zone2Mute: { active: false, value: null, timestamp: 0 },
    playback: { active: false, value: null, timestamp: 0 }
};

// Manages the initial loading spinner visibility.
const INITIAL_SYNC_KEYS = ['power', 'input', 'volume', 'subwoofer'];
export let initialSyncState = new Set(INITIAL_SYNC_KEYS);

/**
 * Resets the initial sync state Set.
 * This is called before a new full status request is made to ensure the
 * loading spinner logic works correctly for each new connection.
 */
export function resetInitialSyncState() {
    // Re-create the set from the master list of keys.
    initialSyncState = new Set(INITIAL_SYNC_KEYS);
}
// --- Interval/Timeout Handles ---
// This object is exported so interval IDs can be managed from other modules.
export const intervals = {
    sleepCountdown: null,
    nowPlayingPoller: null,
    statusPoller: null,
    trackTimeCounter: null,
    // NEW: Handle for the sanity check timer that stops the local track counter if updates cease.
    trackTimeWatchdog: null
};

// --- Data Buffers ---
// A buffer to track which channels were updated during a full CV? query.
export const channelUpdateBuffer = new Set();

// --- Constants ---
// Maps for converting receiver codes to human-readable formats or UI scales.
export const CHANNEL_NAME_MAP = {
    'FL': 'Front Left', 'FR': 'Front Right', 'C': 'Center', 'SW': 'Subwoofer',
    'SL': 'Surround Left', 'SR': 'Surround Right', 'SBL': 'Surround Back Left',
    'SBR': 'Surround Back Right', 'SB': 'Surround Back', 'FHL': 'Front Height Left',
    'FHR': 'Front Height Right', 'FWL': 'Front Wide Left', 'FWR': 'Front Wide Right',
};

export const CHANNEL_SCALE_MAP = {
    'default': { min: -12, max: 12, step: 0.5 },
    'height_wide': { min: -50, max: 49.5, step: 0.5 }
};

export const WIDE_SCALE_CHANNELS = ['FHL', 'FHR', 'FWL', 'FWR'];

export const SOUND_MODE_GROUPS = {
    surround: [
        { label: 'STEREO', command: 'SOUND_MODE_STEREO', responseCode: 'STEREO' },
        { label: 'DOLBY DIGITAL', command: 'SOUND_MODE_DOLBY', responseCode: 'DOLBY DIGITAL' },
        { label: 'DTS SURROUND', command: 'SOUND_MODE_DTS', responseCode: 'DTS SURROUND' },
        { label: 'MCH STEREO', command: 'SOUND_MODE_MCH_STEREO', responseCode: 'MCH STEREO' },
        { label: 'VIRTUAL', command: 'SOUND_MODE_VIRTUAL', responseCode: 'VIRTUAL' }
    ],
    pure: [
        { label: 'DIRECT', command: 'SOUND_MODE_DIRECT', responseCode: 'DIRECT' },
        { label: 'PURE DIRECT', command: 'SOUND_MODE_PURE_DIRECT', responseCode: 'PURE DIRECT' },
        { label: 'AUTO', command: 'SOUND_MODE_AUTO', responseCode: 'AUTO' }
    ]
};