/* global it, describe, expect */

import banjoOpenC from './banjo-open-c';
import { strChord2array, processString } from '../tools';

describe('Banjo (Open C) Chords', () => {
  describe('Strings', () => {
    it('Should have 5 strings', () =>
      expect(banjoOpenC.main.strings).toEqual(5));
    it('Should have 5 frets on chord', () =>
      expect(banjoOpenC.main.fretsOnChord).toEqual(5));
  });

  describe('Tuning', () => {
    it('Should expose Open C tuning (5th→1st)', () => {
      expect(banjoOpenC.tunings.standard).toEqual([
        'G4',
        'C3',
        'G3',
        'C4',
        'E4',
      ]);
    });
  });

  it('Should expose 12 keys', () => {
    expect(banjoOpenC.keys.length).toEqual(12);
  });

  describe('Types', () => {
    banjoOpenC.suffixes.map((suffix) =>
      it(`Type suffix ${suffix} should have a description`, () =>
        expect(suffix).toBeDefined())
    );
  });

  describe('Ab major (ICDb tc.31781-style composite)', () => {
    it('Should include x0134 / 00134 from the Open C Ab major voicing', () => {
      const Ab = banjoOpenC.chords.Ab;
      const major = Ab.find((chord) => chord.suffix === 'major');
      expect(major).toBeDefined();
      expect(major.positions).toEqual(
        expect.arrayContaining([
          { frets: 'x0134', fingers: '00134' },
        ])
      );
    });
  });

  Object.keys(banjoOpenC.chords).map((key) =>
    describe(`Key ${key}`, () => {
      const chords = banjoOpenC.chords[key];

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
                it(`The ${index + 1} position frets array should have 5 values`, () =>
                  expect(frets.length).toEqual(5));
                it(`The ${index + 1} position frets array should have values lower than 16`, () =>
                  expect(Math.max(...frets)).toBeLessThan(16));
                it(`The ${index + 1} position frets array should have at most ${banjoOpenC.main.fretsOnChord} frets of distance`, () =>
                  expect(
                    effectiveFrets.length === 0
                      ? 0
                      : Math.max(...effectiveFrets) - Math.min(...effectiveFrets)
                  ).toBeLessThanOrEqual(banjoOpenC.main.fretsOnChord));
              });

              if (position.fingers) {
                describe('Fingers', () => {
                  const fingers = Array.isArray(position.fingers)
                    ? position.fingers
                    : processString(position.fingers);
                  it(`The ${index + 1} position fingers array should have 5 values`, () =>
                    expect(fingers.length).toEqual(5));
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
