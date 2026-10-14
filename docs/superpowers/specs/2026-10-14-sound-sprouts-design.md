# Sound Sprouts — Design Spec

**Date:** 2026-10-14
**Audience:** one 4-year-old learner (knows some letter names, can spell her name) and her parent.

## Purpose

A free, ad-free, account-free early-reading web app built on systematic synthetic phonics. It runs on an Android tablet (primary) and iPad (secondary), and is hosted on GitHub Pages.

## Lessons carried over from subscription apps

| Keep | Avoid |
|---|---|
| Fixed phonics sequence (s, a, t, p, i, n, …) | Reward economies that outshine learning (tickets/stores) |
| 5–10 minute sessions with a clear end | Large free-roam activity maps |
| Every instruction spoken aloud | Multiple choice that rewards random tapping |
| Mastery gates plus spaced review | Whole-word guessing presented as "reading" |
| Parent co-reading + printable decodable books | Upsells, ads, dark patterns, data collection |
| Large touch targets, no fine motor demands | Pacing nobody watches |

## Slice 1 scope (this plan)

- **Phonemic awareness:** rhyming (picture choice).
- **Letter sounds:** s, a, t, p, i, n, then m, d, g, o, then c, k, e, u, then h, r, f, b, then l, j, v, w, then x, y, z, q. q is taught as "qu" (/kw/) and is never offered against c or k. x has no first-sound pictures and is practised through blends. Then the digraphs sh, ch, th, ng, ck: ck shares c's sound and recording; ng and ck have no first-sound pictures; blend tiles are sounds, so a digraph is one tile; s/sh, c/ch and t/th are never first-sound distractors for each other. c and k share one sound and recording, and are never offered against each other. Two activity types: "find the letter that says /s/" and "which picture starts with /s/" (no picture set for short /i/).
- **Narrated choices:** rhyme and first-sound questions light up each picture in turn and say its word after the question (and again on replay or after a wrong answer, skipping greyed-out pictures). Letter questions narrate each letter by name ("ess, aitch" for sh), never by sound, since that would give the answer away.
- **Blending:** CVC words built only from mastered letters (pin, tap, pan, tin, sip, nap, dog, pig, map, sad, man, cat, cap, pen, ten, sun, nut, cup, hat, bag, bed, bus, bug, log, leg, web, fox, box, six, fish, ship, chick, duck, sock, rock, bath, ring).
- **Name spelling:** tap the letters of her first name in order.
- **Garden progress map:** one plot per letter: seed (locked), sprout (learning), flower (mastered), wilted (mastered but recently missed).
- **Parent area** behind a press-and-hold + arithmetic gate: set the child's name, per-letter status, "needs practice" list, sessions this week, printable mini-book, reset, audio/storage warnings, credits.
- **Installable PWA** that works offline after first load.

## Learning rules

- A session is up to 8 items: warm-up (name if not mastered, else a rhyme), up to 3 focus items (each shown twice), 1 more rhyme, then review (struggling first, then least recently seen).
- Every multiple-choice question offers 3 choices, so random tapping rarely reaches mastery.
- An item is **mastered** when its last 3 attempts were correct on the first try, across at least 2 different sessions. Mastery is sticky for unlocking.
- **Struggling** means 2 or more first-try misses in the last 4 attempts.
- Letters unlock in order. Two are always open; the next unlocks when the previous letter-sound item is mastered.
- Taps are ignored while instructions play. A wrong answer greys that choice, says what it was, and replays the question. Only first-try answers count toward mastery.

## Content sourcing

- **Phonemes:** openly licensed recordings (Wikimedia Commons IPA set) or Piper phoneme synthesis, auditioned and approved by the parent before use.
- **Prompts, words, letter names:** generated offline with Piper TTS using a voice whose license permits redistribution, then committed as MP3.
- **Pictures:** OpenMoji SVGs (CC BY-SA 4.0), vendored.
- **Font:** Andika (SIL OFL), which uses the single-story "a" and "g" that children learn to write.
- Every source is credited on `credits.html`.

## Platform constraints

- Plain HTML/CSS/ES modules with no bundler, so GitHub Pages serves the repo output directly.
- Progress lives in `localStorage` on the device only. No network calls besides fetching the app's own files.
- iOS needs audio started from a tap and HTTP range responses for media, so the service worker serves 206 ranges from cache.
- Public GitHub repository (required for free Pages). It contains no personal data; the child's name is entered on the device only.
