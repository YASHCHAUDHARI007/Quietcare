# Quietcare context

Quietcare is a mobile-first application for working adults who help their parents manage medicines. The parent remains involved and independent; the caregiver gets a clear, traceable routine without an open-ended chat interface.

The reference flow is: welcome, prescription capture, mock extraction, uncertain-field review, medicine capture, medicine matching and quantity confirmation, deterministic stock coverage, language and meal-time personalization, optional printed pouch labels, packing, simulated Telegram connection, and the caregiver home view.

Version one is a connected frontend prototype driven by one typed mock dataset. It does not implement OCR, camera processing, authentication, a database, APIs, notifications, file storage, Telegram, or medical decision support. Prescription information must never be invented, substituted, or autonomously changed. Packing completion and reminder activation are separate concepts, and a reminder-connection failure must never remove a generated routine.

Meaningful progress is stored locally. Calculated coverage and refill information must be deterministic and internally consistent.
