# Examples

This directory contains examples for different types of responses that this sample supports.

`live_agent.json` is an example of a live agent request chip. To support the ability for users to request a live agent verbally, paste this JSON into the Custom Payload section to provide a live agent request chip. The `liveAgentRequest: {}` object is a suggestion that can be added to any payload.

`rich_card.json` is an example of a Rich Card, displaying the menu options for a restaurant.

`carousel.json` is an example of a carousel of rich cards, displaying the different options of food at a restaurant.

`suggestion.json` shows an example of a "fallback" intent. In the case that a user sends a message that Dialogflow does not understand, it will respond with an error message, with three suggestions.

`bm_test_bot.zip` contains an pre-made Dialogflow "restaurant" bot for testing.
