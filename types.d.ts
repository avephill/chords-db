export interface InstrumentChords {
    main: Main;
    tunings: Tunings;
    keys: string[];
    suffixes: string[];
    chords: Chords;
}


export interface Chords {
    [key: string]: ChordDef[];
}

export interface ChordDef {
    key: string;
    suffix: string;
    positions: Position[];
}


export interface Position {
    frets: number[];
    fingers: number[];
    baseFret: number;
    barres: number[];
    midi: number[];
    capo?: boolean;
}

export interface Main {
    strings: number;
    fretsOnChord: number;
    name: string;
    numberOfChords: number;
}

export interface Tunings {
    standard: string[];
    [name: string]: string[];
}

export const guitar: InstrumentChords;
export const ukulele: InstrumentChords;
export const mandolin: InstrumentChords;
export const ukuleleDTuning: InstrumentChords;
export const ukuleleBaritone: InstrumentChords;
export const banjoOpenG: InstrumentChords;
export const banjoDoubleC: InstrumentChords;
export const banjoGModalMountainMinorSawmill: InstrumentChords;
export const banjoDTuning: InstrumentChords;
export const banjoDFsharpTuning: InstrumentChords;
export const banjoOpenC: InstrumentChords;
export const banjoStandardCDropC: InstrumentChords;

export interface IChordsDB {
    guitar: InstrumentChords;
    ukulele: InstrumentChords;
    mandolin: InstrumentChords;
    "ukulele-d-tuning": InstrumentChords;
    "ukulele-baritone": InstrumentChords;
    "banjo-open-g": InstrumentChords;
    "banjo-double-c": InstrumentChords;
    "banjo-gmodal-mountain-minor-sawmill": InstrumentChords;
    "banjo-d-tuning": InstrumentChords;
    "banjo-d-f#-tuning": InstrumentChords;
    "banjo-open-c": InstrumentChords;
    "banjo-standard-c-drop-c": InstrumentChords;
}

declare const ChordsDB: IChordsDB;
export default ChordsDB;