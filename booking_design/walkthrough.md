# Booking System - End-to-End Walkthrough

This scenario demonstrates the full lifecycle of a booking: from configuration to confirmation and calendar sync.

## Phase 1: Configuration (Admin & Collaborator)

1.  **Admin Creates Service**
    *   Admin logs in to Dashboard.
    *   Goes to *Services* -> *New Service*.
    *   Enters: "Consulenza Strategica", 60 min, 100€, Buffer 15 min.
    *   Selects Logic: "OR" (Any consultant works).
    *   Assigns: Alice and Bob.
    *   *Result*: Service ID `S1` created in DB.

2.  **Collaborator Setup (Alice)**
    *   Alice logs in.
    *   Goes to *Availability*.
    *   Sets Recurring: Mon-Fri, 09:00 - 18:00. Use visual grid editor.
    *   **Connects Google Calendar**:
        *   Clicks "Connect Google".
        *   Pop-up -> Grants permission.
        *   System saves tokens.
    *   *Result*: `availability_rules` + `external_calendar_connections` updated.

## Phase 2: The Booking Flow (User)

3.  **User Search**
    *   Guest user lands on `/booking`.
    *   Sees "Consulenza Strategica". Clicks "Book".
    *   Selects Date: "Tomorrow".

4.  **Availability Calculation (System)**
    *   Frontend request: `GET /availability?service=S1&date=Tomorrow`.
    *   Backend fetches:
        *   Alice's Rules (9-18)
        *   Alice's Google Events (Busy 10:00-11:00)
        *   Bob's Rules (Maybe he's off tomorrow).
    *   Calculates Slots: 09:00, 09:15, 11:15... (skipping 10-11 for Alice).
    *   Returns list of `StartTimes`.

5.  **Slot Selection**
    *   User clicks **11:15**.
    *   Backend creates a **HOLD** in `booking_holds` (expires in 10m).
    *   User fills form: "Mario Rossi", "mario@email.com".

6.  **Confirmation**
    *   User clicks "Confirm".
    *   System:
        1.  Verifies Hold is valid.
        2.  Creates `booking` (Status: CONFIRMED).
        3.  Assigns Alice (since Bob was off).
        4.  **Sync**: Calls Google API to insert Event "Consulenza - Mario" on Alice's calendar.
        5.  **Email**: Sends invite to Mario and notification to Alice.
        6.  Deletes Hold.

## Phase 3: Lifecycle

7.  **Reschedule**
    *   Mario clicks link in email "Reschedule".
    *   Selects new time Next Day 14:00.
    *   System checks Alice's availability -> Confirms.
    *   Updates `booking`.
    *   Updates Google Calendar Event (Move).

8.  **Completion**
    *   Day passes. Admin marks as "Completed".
    *   History stored in `bookings`.
