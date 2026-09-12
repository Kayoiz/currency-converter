# Currency Converter

Highlight any price on any page and see it in the currency you actually think in.

Chrome and Brave extension. Free, no account, no tracking.

## What it does

Select a price with your mouse. A small bar appears above it with the converted
amount. That is the whole interaction.

- 155 currencies, searchable by code, country or currency name
- Up to six currencies side by side
- Click a converted number to copy it with its symbol
- Save the currencies you use most so they stay at the top of the list
- A built-in converter for when there is nothing on screen to select
- Seven interface languages: English, Hebrew, Russian, Spanish, Japanese,
  Chinese, Korean

## It only reacts to prices

`1299`, `$28` and `24.59 USD` bring up the bar. `Add to cart`, `4.7 stars` and
`16 GB` do not. The rule: if anything is left over after removing the number and
the currency marker, the extension stays out of the way.

## Settings

Five colour themes, adjustable size, adjustable transparency, and a choice of
fonts for the numbers. A master switch turns everything off everywhere at once
and remembers your settings for when you switch it back on.

## Privacy

Nothing is collected. No analytics, no accounts, no tracking, no ads.

Settings live in your own browser and sync through your own Google account, the
same way bookmarks do. The only thing that leaves your machine is an amount and
two currency codes, sent to a public rates service.

Full policy: [privacy-policy.md](privacy-policy.md)

## Rates

[ExchangeRate-API](https://www.exchangerate-api.com), with
[currency-api](https://github.com/fawazahmed0/exchange-api) as a fallback.
Refreshed automatically every few hours, or on demand.

Flags from [flagcdn.com](https://flagcdn.com).

## Installing from source

1. Download or clone this repository
2. Open `chrome://extensions` (or `brave://extensions`)
3. Turn on Developer mode
4. Click "Load unpacked" and pick the folder

## Licence

All rights reserved. The source is public so you can read it and see exactly
what the extension does. It is not licensed for reuse, redistribution or
republication.

## Third party notices

Fonts and services used are credited in
[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
