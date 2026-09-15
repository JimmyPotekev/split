// Group slugs are short random tokens. They're the credential for the group,
// so they need enough entropy to not be guessable, but short enough that a URL
// isn't ugly. 10 chars from nanoid's default alphabet (64) is ~60 bits, plenty
// for our threat model (unauthed friends splitting bills).

import { customAlphabet } from 'nanoid'

// Excluding lookalikes: 0, O, 1, l, I. Just a nice-to-have if anyone ever
// reads a URL over the phone.
const alphabet = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
export const newSlug = customAlphabet(alphabet, 10)
