/* global it, describe, expect */

import plecturnIrish from './plecturn-4-string-banjo-irish-tuning';
import { strChord2array, processString } from '../tools';

describe('Plectrum 4-string banjo (Irish tuning) Chords', () => {
  describe('Strings', () => {
    it('Should have 4 strings', () =>
      expect(plecturnIrish.main.strings).toEqual(4));
    it('Should define fretsOnChord for span checks', () =>
      expect(plecturnIrish.main.fretsOnChord).toEqual(5));
  });

  describe('Types', () => {
    plecturnIrish.suffixes.map((suffix) =>
      it(`Type suffix ${suffix} should have a description`, () =>
        expect(suffix).toBeDefined())
    );
  });

  describe('A major', () => {
    it('Should have positions with 4-string frets', () => {
      const Amajor = plecturnIrish.chords.A.find(
        (chord) => chord.suffix === 'major'
      );
      expect(Amajor.positions.length).toBeGreaterThan(0);
      Amajor.positions.forEach((position) => {
        const frets = Array.isArray(position.frets)
          ? position.frets
          : strChord2array(position.frets);
        expect(frets.length).toEqual(4);
        expect(Math.max(...frets)).toBeLessThan(16);
      });
    });
  });

  Object.keys(plecturnIrish.chords).map((key) =>
    describe(`Key ${key}`, () => {
      const chords = plecturnIrish.chords[key];

      it(`Should not have duplicated suffixes`, () => {
        const seen = new Set();
        const duplicates = chords.some(
          (chord) => seen.size === seen.add(chord.suffix).size
        );
        expect(duplicates).toBe(false);
      });

      chords.map((chord) =>
        describe(`Suffix ${chord.key}${chord.suffix}`, () => {
          describe('General properties', () => {
            it(`The chord ${key}${chord.suffix} should have a defined key property`, () =>
              expect(chord.key).toEqual(key));
            it(`The chord ${key}${chord.suffix} should have a defined suffix property`, () =>
              expect(chord.suffix).toBeDefined());
            it(`The chord ${key}${chord.suffix} should have a list of positions`, () =>
              expect(chord.positions).toBeInstanceOf(Array));
          });

          describe('Positions', () => {
            chord.positions.map((position, index) => {
              const frets = Array.isArray(position.frets)
                ? position.frets
                : strChord2array(position.frets);
              const effectiveFrets = frets.filter((f) => f > 0);
              describe('Frets', () => {
                it(`The ${index + 1} position frets array should have 4 values`, () =>
                  expect(frets.length).toEqual(4));
                it(`The ${index + 1} position frets array should have values lower than 16`, () =>
                  expect(Math.max(...frets)).toBeLessThan(16));
                it(`The ${index + 1} position fret span should be at most ${plecturnIrish.main.fretsOnChord}`, () =>
                  expect(
                    effectiveFrets.length === 0
                      ? 0
                      : Math.max(...effectiveFrets) - Math.min(...effectiveFrets)
                  ).toBeLessThanOrEqual(plecturnIrish.main.fretsOnChord));
              });

              if (position.fingers) {
                describe('Fingers', () => {
                  const fingers = Array.isArray(position.fingers)
                    ? position.fingers
                    : processString(position.fingers);
                  it(`The ${index + 1} position fingers array should have 4 values`, () =>
                    expect(fingers.length).toEqual(4));
                  it(`The ${index + 1} position fingers array should have values lower than 5`, () =>
                    expect(Math.max(...fingers)).toBeLessThan(5));
                  it(`The ${index + 1} position fingers array should have values higher or equal to 0`, () =>
                    expect(Math.min(...fingers)).toBeGreaterThanOrEqual(0));
                });
              }
            });
          });
        })
      );
    })
  );
});
