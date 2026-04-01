import { default as guitar } from './db/guitar';
import { default as ukulele } from './db/ukulele';
import { default as mandolin } from './db/mandolin';
import { default as ukuleleDTuning} from './db/ukulele-d-tuning';
import { default as ukuleleBaritone } from './db/ukulele-baritone';
import { default as banjoOpenG } from './db/banjo-open-g';

export default {
  guitar,
  ukulele,
  mandolin,
  "ukulele-d-tuning": ukuleleDTuning,
  "ukulele-baritone": ukuleleBaritone,
  "banjo-open-g": banjoOpenG
};
