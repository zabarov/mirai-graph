# Notification Delivery Package

The notification package sends email and webhook messages when important
workflow events occur. Delivery workers must use scoped tokens and must not send
notifications until the triggering event has been audited.

Open issue: retry behavior must avoid duplicate notifications for the same
workflow transition.
