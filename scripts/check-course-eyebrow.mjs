// Node 22.18+ strips the internal helper's TypeScript types for this focused check.
import assert from 'node:assert/strict'
import { courseEyebrow } from '../src/courseEyebrow.ts'
const course = {id: 'foundations', title: 'Linux Foundations'}
assert.equal(courseEyebrow('Linux', undefined, course, 'title'), 'LINUX · FOUNDATIONS')
assert.equal(courseEyebrow('Linux', undefined, course, 'id'), 'LINUX · FOUNDATIONS')
assert.equal(courseEyebrow('Linux', undefined, {id:'legacy-id',title:'Linux Foundations'}, 'id'), 'LINUX · LEGACY-ID')
assert.equal(courseEyebrow('Apache Spark', 'SPARK', {id:'engine',title:'Spark Engine'}, 'title'), 'SPARK · ENGINE')
assert.equal(courseEyebrow('Apache Spark', 'SPARK', {id:'engine',title:'Apache Spark Engine'}, 'title'), 'SPARK · ENGINE')
assert.equal(courseEyebrow('SQL', undefined, {id:'schema',title:'Modeling data'}, 'title'), 'SQL · MODELING DATA')
assert.equal(courseEyebrow('SQL', undefined, {id:'sql',title:'SQL'}, 'title'), 'SQL · SQL')
assert.equal(courseEyebrow('Linux', undefined, {id:'x',title:' linux Foundations '}, 'title'), 'LINUX · FOUNDATIONS')
console.log('Course eyebrow checks passed: title, legacy ID, custom prefix, duplicate subject, whitespace')
