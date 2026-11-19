import { expect, test } from 'bun:test'
import { isTechPage, isTerm, maxStatus, slugify } from './lib'

test('slugify', () => {
  expect(slugify('  React Hooks! ')).toBe('react-hooks')
  expect(slugify('C++')).toBe('cplusplus')
  expect(slugify('C#')).toBe('csharp')
  expect(slugify('Café Négatif')).toBe('cafe-negatif')
})

test('isTerm', () => {
  expect(isTerm('vector clock')).toBe(true)
  expect(isTerm('a')).toBe(false)
  expect(isTerm('one two three four five six')).toBe(false)
  expect(isTerm('1234')).toBe(false)
})

test('isTechPage', () => {
  expect(isTechPage('github.com', 0)).toBe(true)
  expect(isTechPage('docs.python.org', 0)).toBe(true)
  expect(isTechPage('bun.dev', 0)).toBe(true)
  expect(isTechPage('nytimes.com', 0)).toBe(false)
  expect(isTechPage('blog.example.com', 3)).toBe(true)
  expect(isTechPage('notgithub.com', 0)).toBe(false)
})

test('maxStatus', () => {
  expect(maxStatus('known', 'seen')).toBe('known')
  expect(maxStatus('new', 'seen')).toBe('seen')
})
