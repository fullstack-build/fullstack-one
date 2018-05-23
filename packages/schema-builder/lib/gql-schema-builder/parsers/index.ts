
import * as jsonParser from './json';
import * as idParser from './id';
import * as computedParser from './computed';
import * as customParser from './custom';
import * as relationParser from './relation';
import * as defaultParser from './default';
import * as viewnamesParser from './viewnames';
import * as expressionsParser from './expressions';
import * as mutationsParser from './mutations';

export const parsers = [
  jsonParser,
  idParser,
  computedParser,
  customParser,
  relationParser,
  defaultParser,
  viewnamesParser,
  expressionsParser,
  mutationsParser
];
