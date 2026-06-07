# Report - Fonio Track @ Hack Vienna

## Problem Framing

We chose a dental praxis for that we build a calling agent that takes appointments, cancels them and reschedules appointments to keep the calendar booked.

## Solution overview

We decided to optimize for having strong logic when picking the right user for a reschedule call (details see [RANKING.md](/ranking.md)) and to give the analyst a rich experience (can talk about dentist information like appointment types, opening hours, price, etc... but also redirect to a human if possible). On top of this we built a webui for the staff at the dentist to keep track of their bookings and see which users are being currently booked.

### Inbound agent

The inbound agent handles booking an appointment, cancelling an appointment and getting information for the dentist.

#### How did we detect a cancellation?

Cancellations are detected through the Fonio API using the Variable Extraction Tool. We tried running our own LLM over the conversation but the Fonio solution proved to be more accurate.
The Variable extraction looks like this:

```json
{
  "didCancel": {
    "type": ["boolean", "null"],
    "description": "Did the user cancel his appointment? true if he cancelled his appointment, false if he booked an appointment or did anything else than cancel an appointment"
  }
}
```


#### What happens after a cancellation?

If the user decided to cancel an appointment, `didCancel` returns true very reliably. If the user canceled an appointment, we are going to the Google Calendar API (through IAM profile) to get the latest cancelled date (we took the assumption here, that the agent handles calls sequentially. We had the issue that we could not map the Fonio appointments to Google Calendar entires, this is not technically trivial so we went with last removed date).

When the last cancelled date is retrieved, we have all the information to go through the next step:

Output information:

- Cancelled date start and end
- Event type (Dental cleaning, Pain, Annual Checkup)

The event type is important so that we can pick a suited user from the waiting list that actually matches our event type (a user that wants an annual checkup won't get booked on an urgend pain case).

### Select the correct user

Details see [RANKING.md](/ranking.md)

### Outbound scheduling agent

For the outbound scheduling agent we created a new Fonio assistant and connected it with one of our phone numbers.
To be able to customize the outbound calls, we defined a custom system prompt with variables that allow for Name, Phone, Email and most importantly the old booking information and the new booking information. What we learnt is that if the assistant speaks the assistant dates out loud he is way more likely to book the correct slots.

The prompt we use can be found [here](/materials/outbound-prompt.md).

The outbound agent also uses the Fonio variable extraction like the following:

```json
{
  "didSchedule": {
    "type": ["boolean", "null"],
    "description": "Did the user accept the new appointment slot? true if he accepts the new appointment slot and it got booked correctly, false if he did not accept the new appointment slot or it could not get booked"
  },
  "requestedCallbackInMinutes": {
    "type": ["integer", "null"],
    "description": "only if the user explicitly asks for a call back fill in the minutes the user asks for (15 is default). if the user only agrees to the future call for open spots, this does not count as callback. use 0 in this case and any case where the user does not ask for a call back"
  },
  "reachedMailbox": {
    "type": ["boolean", "null"],
    "description": "true if the assistant reached the voicemail indicated by something like you reached the mailbox, leave a message after the beep. false, if talked to a human."
  }
}
```

The single parts:

- `didSchedule`: it's used to decide if it should call the second person from the list, eg. when the first one said "No", we're gonna take the second user from the waitlist
- `requestedCallbackInMinutes`: we decided that the user might be busy and wanted to catch the edge case when he tells us "Please call me back in 10 minutes". If this variable is returned, we're stopping the calling and schedule another call after the amount of minutes given
- `reachedMailbox`: if the assistant reaches the mailbox, it sends out an SMS telling the person to call us back for an appointment. For SMS sending we are also using the Fonio infrastructure.

[Alfred sends an SMS](/materials/alfred-sms.jpeg)

