# Changelog

## [0.3.1] - 2023-07-31

- Fixed access token not resolving if browser was closed during a refresh attempt

## [0.3.0] - 2021-12-03

- Added throw on missing/invalid state
- Added extra params option to login method
- Changed lock implementation to use broadcast channel in browsers than support it
- Removed the 0-1s refresh delay that is no longer needed
- Removed downlevel ts

## [0.2.0] - 2021-07-09

- Added post logout redirect URL option
- Stopped logout from triggering access token event

## [0.1.1] - 2021-07-08

- Fixed downlevel ts select for old versions of typescript

## [0.1.0] - 2021-07-08

- Initial release
