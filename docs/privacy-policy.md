# Privacy Policy for SimpleDial

_Last updated: 2026-09-07_

SimpleDial is a browser extension that recognizes phone numbers on web pages and lets you
place a call through the phone handler registered in your browser or operating system (via
the standard `tel:` address).

## What Data We Collect

**None.** SimpleDial does not collect, store, or transmit any personal data or browsing
information.

- It has no servers and makes no network connections of any kind.
- It contains no analytics, tracking, or telemetry.
- It uses no third-party services. It bundles one third-party **library**, which runs
  entirely on your device and makes no network requests of its own (see Third-Party
  Code below).

## What the Extension Reads, and Why

The "Call" entry has to be ready before Chrome draws the right-click menu, so SimpleDial
prepares it slightly in advance:

1. **The link or selection you point at** — as the pointer moves over a link, or as the text
   selection changes, SimpleDial reads that link's `tel:` / `callto:` address, the link's
   visible text, and the selected text. Only the most recent of these is kept, and only to
   build the "Call <number>" entry and place the call you choose.
2. **A number you type into the dialing panel** (the small popup opened from the toolbar
   icon, if you enable it) — used solely to place that call.
3. **A `tel:` link you left-click**, but only if you switch on "handle left-clicks on
   `tel:` links", which is **off by default**. With it on, SimpleDial reads the address of
   the link you clicked and places that call instead of letting the browser hand it over.
   It reads nothing else, and holding Ctrl, Shift or Alt always leaves the click to the
   browser.

These values are held briefly in the browser's session storage, which the browser clears
when it closes. They are never written permanently to disk, never sent to us, and never
shared with anyone other than the handler you yourself chose — see *Where the Number Goes*
below.

If you turn on **"Call from your phone with a QR code"**, the same number is instead drawn
as a QR code in a small window belonging to the extension. The code is generated on your
computer, from the number already in session storage. Nothing is uploaded to build it, no
image is fetched from anywhere, and the number still never leaves your device.

Nothing else on the page is read: not the surrounding content, not form fields, not what
you type elsewhere. SimpleDial never scans or indexes pages, does **not** modify any page,
and does **not** track which pages you visit. It does listen for clicks and pointer
movement in order to know what you are pointing at — but only ever looks at the link or
selection itself, never at anything around it.

## Where the Number Goes

SimpleDial does not place calls itself. It hands the `tel:` address to the handler already
registered in your browser or operating system — the same handoff that happens when you
click a phone link on a web page yourself.

Which handler receives it is **your** choice, made outside SimpleDial. Chrome lists the web
applications you have allowed at `chrome://settings/handlers`; your operating system holds
its own default for desktop programs.

- **If your handler is a desktop program** — a softphone, a desktop Skype, your system's
  phone app — the number stays on your computer.
- **If you have registered a *web* application** — a browser-based softphone, a hosted PBX
  interface, a web calling service — the number is passed to that website, exactly as it
  would be if you had clicked a phone link. That exchange is between you and the service you
  already use.
- **In QR mode** nothing is handed to any handler at all: the code is drawn on your computer
  and read by your own phone's camera.

SimpleDial does not choose that handler, cannot see what it does with the number, and has no
relationship with whoever runs it. What such a service collects, and how it treats your data,
is governed by its own privacy policy rather than this one.

## Settings Storage

Your extension settings are saved locally on your device using the browser's local
extension storage:

- the phone-number recognition rule,
- the dialing scheme (`tel:`, `callto:`, `sip:`, or `skype:`),
- whether the toolbar icon opens your phone app or a dialing panel,
- whether calls are shown as a QR code instead of being placed from this computer,
- whether a left-click on a `tel:` link is handled by SimpleDial (off unless you turn it on).

This data stays on your device. It is **not** synced to any account and **not** transmitted
to us or to anyone else. Removing the extension deletes it.

## Third-Party Code

SimpleDial itself contacts no servers: it contains no networking code at all — no `fetch`,
no `XMLHttpRequest`, no `WebSocket`. (The `tel:` handler you have registered may itself be a
web service; see *Where the Number Goes*.)

It does include one third-party **library**, bundled inside the extension:

- **qrcode-generator** by Kazuhiko Arase (release 1.4.4), MIT license, bundled without any
  modification. The file ships exactly as published; its SHA-256 is
  `18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780`.
  It is used only to turn a phone number into the black-and-white pattern of a QR code. It
  performs no network requests, reads nothing from the page or from your browser, and has
  no access to your settings. It is pure computation: a string goes in, a grid of squares
  comes out, and SimpleDial draws that grid itself.

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED, used here descriptively to
refer to the technology.

## Data Sharing

No data is collected, so there is nothing for us to share or sell, and nothing is disclosed
to any third party by SimpleDial. The one place a number travels outward is the handler you
chose yourself, described in *Where the Number Goes*.

## Data Retention and Deletion

- Settings persist on your device until you change them or uninstall the extension.
- The transient phone number used for a call is discarded automatically (at the latest when
  the browser closes).
- You can reset the recognition rule from the options page at any time.

## Changes to This Policy

If this policy changes, the "Last updated" date above will change and the new version will
be published at the same URL.

## Contact

For questions about this policy or the extension's privacy practices, contact:

Ertagus@gmail.com
