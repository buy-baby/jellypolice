var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// node_modules/itty-router/index.mjs
var e = /* @__PURE__ */ __name(({ base: e2 = "", routes: t = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: (o3, s2, r, n) => "handle" == s2 ? r.fetch : (o4, ...a) => t.push([s2.toUpperCase?.(), RegExp(`^${(n = (e2 + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), a, n]) && r }), routes: t, ...o2, async fetch(e3, ...o3) {
  let s2, r, n = new URL(e3.url), a = e3.query = { __proto__: null };
  for (let [e4, t2] of n.searchParams)
    a[e4] = a[e4] ? [].concat(a[e4], t2) : t2;
  for (let [a2, c2, i2, l2] of t)
    if ((a2 == e3.method || "ALL" == a2) && (r = n.pathname.match(c2))) {
      e3.params = r.groups || {}, e3.route = l2;
      for (let t2 of i2)
        if (null != (s2 = await t2(e3.proxy ?? e3, ...o3)))
          return s2;
    }
} }), "e");
var o = /* @__PURE__ */ __name((e2 = "text/plain; charset=utf-8", t) => (o2, { headers: s2 = {}, ...r } = {}) => void 0 === o2 || "Response" === o2?.constructor.name ? o2 : new Response(t ? t(o2) : o2, { headers: { "content-type": e2, ...s2.entries ? Object.fromEntries(s2) : s2 }, ...r }), "o");
var s = o("application/json; charset=utf-8", JSON.stringify);
var c = o("text/plain; charset=utf-8", String);
var i = o("text/html");
var l = o("image/jpeg");
var p = o("image/png");
var d = o("image/webp");

// node_modules/bcryptjs/index.js
var import_crypto = __toESM(require_crypto(), 1);
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return import_crypto.default.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
__name(randomBytes, "randomBytes");
function setRandomFallback(random) {
  randomFallback = random;
}
__name(setRandomFallback, "setRandomFallback");
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4)
    rounds = 4;
  else if (rounds > 31)
    rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10)
    salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
__name(genSaltSync, "genSaltSync");
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function")
    callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined")
    rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(genSalt, "genSalt");
function hashSync(password, salt) {
  if (typeof salt === "undefined")
    salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number")
    salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
__name(hashSync, "hashSync");
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(hash, "hash");
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i2 = 0; i2 < known.length; ++i2) {
    diff |= known.charCodeAt(i2) ^ unknown.charCodeAt(i2);
  }
  return diff === 0;
}
__name(safeStringCompare, "safeStringCompare");
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60)
    return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
__name(compareSync, "compareSync");
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err)
          callback2(err);
        else
          callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(compare, "compare");
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
__name(getRounds, "getRounds");
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
__name(getSalt, "getSalt");
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
__name(truncates, "truncates");
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c2 = 0;
  for (var i2 = 0; i2 < string.length; ++i2) {
    c2 = string.charCodeAt(i2);
    if (c2 < 128)
      len += 1;
    else if (c2 < 2048)
      len += 2;
    else if ((c2 & 64512) === 55296 && (string.charCodeAt(i2 + 1) & 64512) === 56320) {
      ++i2;
      len += 4;
    } else
      len += 3;
  }
  return len;
}
__name(utf8Length, "utf8Length");
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i2 = 0, k = string.length; i2 < k; ++i2) {
    c1 = string.charCodeAt(i2);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i2 + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i2;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
__name(utf8Array, "utf8Array");
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length)
    throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
__name(base64_encode, "base64_encode");
function base64_decode(s2, len) {
  var off = 0, slen = s2.length, olen = 0, rs = [], c1, c2, c3, c4, o2, code;
  if (len <= 0)
    throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s2.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s2.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1)
      break;
    o2 = c1 << 2 >>> 0;
    o2 |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o2));
    if (++olen >= len || off >= slen)
      break;
    code = s2.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1)
      break;
    o2 = (c2 & 15) << 4 >>> 0;
    o2 |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o2));
    if (++olen >= len || off >= slen)
      break;
    code = s2.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o2 = (c3 & 3) << 6 >>> 0;
    o2 |= c4;
    rs.push(String.fromCharCode(o2));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++)
    res.push(rs[off].charCodeAt(0));
  return res;
}
__name(base64_decode, "base64_decode");
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l2 = lr[off], r = lr[off + 1];
  l2 ^= P[0];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[2];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[4];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[6];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[8];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[10];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[12];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[14];
  n = S[l2 >>> 24];
  n += S[256 | l2 >> 16 & 255];
  n ^= S[512 | l2 >> 8 & 255];
  n += S[768 | l2 & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l2 ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l2;
  return lr;
}
__name(_encipher, "_encipher");
function _streamtoword(data, offp) {
  for (var i2 = 0, word = 0; i2 < 4; ++i2)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
__name(_streamtoword, "_streamtoword");
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i2 = 0; i2 < plen; i2++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i2] = P[i2] ^ sw.key;
  for (i2 = 0; i2 < plen; i2 += 2)
    lr = _encipher(lr, 0, P, S), P[i2] = lr[0], P[i2 + 1] = lr[1];
  for (i2 = 0; i2 < slen; i2 += 2)
    lr = _encipher(lr, 0, P, S), S[i2] = lr[0], S[i2 + 1] = lr[1];
}
__name(_key, "_key");
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i2 = 0; i2 < plen; i2++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i2] = P[i2] ^ sw.key;
  offp = 0;
  for (i2 = 0; i2 < plen; i2 += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i2] = lr[0], P[i2 + 1] = lr[1];
  for (i2 = 0; i2 < slen; i2 += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i2] = lr[0], S[i2 + 1] = lr[1];
}
__name(_ekskey, "_ekskey");
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else
      throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else
      throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i2 = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback)
      progressCallback(i2 / rounds);
    if (i2 < rounds) {
      var start = Date.now();
      for (; i2 < rounds; ) {
        i2 = i2 + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME)
          break;
      }
    } else {
      for (i2 = 0; i2 < 64; i2++)
        for (j = 0; j < clen >> 1; j++)
          _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i2 = 0; i2 < clen; i2++)
        ret.push((cdata[i2] >> 24 & 255) >>> 0), ret.push((cdata[i2] >> 16 & 255) >>> 0), ret.push((cdata[i2] >> 8 & 255) >>> 0), ret.push((cdata[i2] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else
        return ret;
    }
    if (callback)
      nextTick(next);
  }
  __name(next, "next");
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true)
      if (typeof (res = next()) !== "undefined")
        return res || [];
  }
}
__name(_crypt, "_crypt");
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else
      throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else
      throw err;
  }
  if (salt.charAt(2) === "$")
    minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else
        throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else
      throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a")
      res.push(minor);
    res.push("$");
    if (rounds < 10)
      res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  __name(finish, "finish");
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2)
          callback(err2, null);
        else
          callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
__name(_hash, "_hash");
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
__name(encodeBase64, "encodeBase64");
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
__name(decodeBase64, "decodeBase64");
var bcryptjs_default = {
  setRandomFallback,
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
  truncates,
  encodeBase64,
  decodeBase64
};

// src/index.js
var router = e();
function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init
  });
}
__name(json, "json");
function ok() {
  return new Response(null, { status: 204 });
}
__name(ok, "ok");
function unauthorized() {
  return json({ error: "unauthorized" }, { status: 401 });
}
__name(unauthorized, "unauthorized");
async function readBody(request) {
  const text = await request.text();
  if (!text)
    return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
__name(readBody, "readBody");
function isAdmin(request, env) {
  const token = env.API_TOKEN || "";
  if (!token)
    return true;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${token}`;
}
__name(isAdmin, "isAdmin");
var DEFAULT_PAGES = {
  agency: {
    title: "\uC824\uB9AC\uACBD\uCC30\uCCAD \uAE30\uAD00 \uC18C\uAC1C",
    content: "\uC824\uB9AC \uACBD\uCC30\uCCAD\uC740 \uC2DC\uBBFC\uC758 \uC548\uC804\uACFC \uC9C8\uC11C\uB97C \uC704\uD574 \uC874\uC7AC\uD569\uB2C8\uB2E4."
  },
  rank: {
    title: "\uC824\uB9AC\uACBD\uCC30\uCCAD \uC9C1\uAE09\uD45C",
    high: { \uCE58\uC548\uCD1D\uAC10: "", \uCE58\uC548\uC815\uAC10: "", \uCE58\uC548\uAC10: "" },
    mid: { \uACBD\uBB34\uAD00: "", \uCD1D\uACBD: "", \uACBD\uC815: "", \uACBD\uAC10: "" },
    normal: {
      \uACBD\uC704: ["", "", "", "", ""],
      \uACBD\uC0AC: ["", "", "", "", ""],
      \uACBD\uC7A5: ["", "", "", "", ""],
      \uC21C\uACBD: ["", "", "", "", ""]
    },
    probation: ["", "", "", "", ""]
  },
  department: {
    title: "\uBD80\uC11C \uC18C\uAC1C",
    teams: [
      { name: "\uAC10\uC0AC\uD300", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uC778\uC0AC\uD300", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uD2B9\uC218 \uAC80\uAC70 \uAE30\uB3D9\uB300(SCP)", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uD2B9\uACF5\uB300(SOU)", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uD56D\uACF5\uD300(ASD)", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." }
    ]
  },
  apply_conditions: {
    title: "\uC824\uB9AC \uACBD\uCC30\uCCAD \uCC44\uC6A9 \uC548\uB0B4",
    cards: {
      eligibility: {
        title: "\uC9C0\uC6D0 \uC790\uACA9 \uC548\uB0B4",
        content: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      },
      disqualify: {
        title: "\uC9C0\uC6D0 \uBD88\uAC00 \uC0AC\uC720",
        content: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      },
      preference: {
        title: "\uC9C0\uC6D0 \uC6B0\uB300 \uC0AC\uD56D",
        content: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      }
    },
    side: {
      linkText: "\uB9C1\uD06C1",
      linkUrl: "#"
    }
  }
};
async function getOrSeedPage(env, key) {
  const row = await env.DB.prepare("SELECT page_json FROM pages WHERE page_key = ?").bind(key).first();
  if (row && row.page_json) {
    try {
      return JSON.parse(row.page_json);
    } catch {
      return DEFAULT_PAGES[key] || {};
    }
  }
  const data = DEFAULT_PAGES[key] || {};
  await env.DB.prepare(
    "INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)"
  ).bind(key, JSON.stringify(data), (/* @__PURE__ */ new Date()).toISOString()).run();
  return data;
}
__name(getOrSeedPage, "getOrSeedPage");
async function setPage(env, key, data) {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)"
  ).bind(key, JSON.stringify(data || {}), (/* @__PURE__ */ new Date()).toISOString()).run();
}
__name(setPage, "setPage");
router.get(
  "/",
  () => new Response("Jelly Police D1 API is running", {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  })
);
router.get("/api/health", () => json({ ok: true }));
router.get("/api/agency", async (req, env) => json(await getOrSeedPage(env, "agency")));
router.get("/api/rank", async (req, env) => json(await getOrSeedPage(env, "rank")));
router.get("/api/department", async (req, env) => json(await getOrSeedPage(env, "department")));
router.get(
  "/api/apply/conditions",
  async (req, env) => json(await getOrSeedPage(env, "apply_conditions"))
);
router.put("/api/agency", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  await setPage(env, "agency", await readBody(req));
  return ok();
});
router.put("/api/rank", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  await setPage(env, "rank", await readBody(req));
  return ok();
});
router.put("/api/department", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  await setPage(env, "department", await readBody(req));
  return ok();
});
router.put("/api/apply/conditions", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  await setPage(env, "apply_conditions", await readBody(req));
  return ok();
});
router.get("/api/notices", async (req, env) => {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 5), 20);
  const { results } = await env.DB.prepare(
    "SELECT id, title, content, created FROM notices ORDER BY id DESC LIMIT ?"
  ).bind(limit).all();
  return json(results || []);
});
router.post("/api/notices", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  const body = await readBody(req);
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content)
    return json({ error: "title/content required" }, { status: 400 });
  const created = (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    "INSERT INTO notices(title, content, created) VALUES(?, ?, ?)"
  ).bind(title, content, created).run();
  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});
router.get("/api/notices/:id", async (req, env) => {
  const id = Number(req.params.id);
  if (!id)
    return json({ error: "bad_id" }, { status: 400 });
  const row = await env.DB.prepare(
    "SELECT id, title, content, created FROM notices WHERE id = ?"
  ).bind(id).first();
  if (!row)
    return json({ error: "not_found" }, { status: 404 });
  return json(row);
});
router.put("/api/notices/:id", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  const id = Number(req.params.id);
  if (!id)
    return json({ error: "bad_id" }, { status: 400 });
  const body = await readBody(req);
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content)
    return json({ error: "title/content required" }, { status: 400 });
  const r = await env.DB.prepare(
    "UPDATE notices SET title = ?, content = ? WHERE id = ?"
  ).bind(title, content, id).run();
  if (!r.meta || r.meta.changes === 0)
    return json({ error: "not_found" }, { status: 404 });
  return ok();
});
router.delete("/api/notices/:id", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  const id = Number(req.params.id);
  if (!id)
    return json({ error: "bad_id" }, { status: 400 });
  await env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(id).run();
  return ok();
});
router.get("/api/complaints", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT id, name, identity, content, created, fileName, fileKey FROM complaints ORDER BY id DESC"
  ).all();
  return json(results || []);
});
router.post("/api/complaints", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    "INSERT INTO complaints(name, identity, content, created, fileName, fileKey) VALUES(?, ?, ?, ?, ?, ?)"
  ).bind(
    body.name || "",
    body.identity || "",
    body.content || "",
    created,
    body.fileName || "",
    body.fileKey || ""
  ).run();
  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});
router.get("/api/suggestions", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT id, name, identity, content, created FROM suggestions ORDER BY id DESC"
  ).all();
  return json(results || []);
});
router.post("/api/suggestions", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    "INSERT INTO suggestions(name, identity, content, created) VALUES(?, ?, ?, ?)"
  ).bind(body.name || "", body.identity || "", body.content || "", created).run();
  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});
var src_default = {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};
router.post("/api/auth/register", async (req, env) => {
  const body = await readBody(req);
  const uniqueCode = (body.uniqueCode || "").trim();
  const nickname = (body.nickname || "").trim();
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!uniqueCode || !nickname || !username || !password) {
    return json({ error: "all_fields_required" }, { status: 400 });
  }
  const exists = await env.DB.prepare(
    "SELECT id FROM users WHERE LOWER(username) = LOWER(?)"
  ).bind(username).first();
  if (exists) {
    return json({ error: "username_taken" }, { status: 409 });
  }
  const passwordHash = await bcryptjs_default.hash(password, 10);
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    "INSERT INTO users(uniqueCode, nickname, username, passwordHash, role, createdAt) VALUES(?, ?, ?, ?, 'user', ?)"
  ).bind(uniqueCode, nickname, username, passwordHash, createdAt).run();
  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});
router.post("/api/auth/login", async (req, env) => {
  const body = await readBody(req);
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) {
    return json({ error: "username_password_required" }, { status: 400 });
  }
  const user = await env.DB.prepare(
    "SELECT id, uniqueCode, nickname, username, passwordHash, role, createdAt FROM users WHERE LOWER(username) = LOWER(?)"
  ).bind(username).first();
  if (!user)
    return json({ error: "invalid_credentials" }, { status: 401 });
  const okPw = await bcryptjs_default.compare(password, user.passwordHash || "");
  if (!okPw)
    return json({ error: "invalid_credentials" }, { status: 401 });
  return json({
    id: user.id,
    uniqueCode: user.uniqueCode,
    nickname: user.nickname,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt
  });
});
router.get("/api/admin/users", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT id, uniqueCode, nickname, username, role, createdAt FROM users ORDER BY id DESC LIMIT 500"
  ).all();
  return json(results || []);
});
router.put("/api/admin/users/:id/role", async (req, env) => {
  if (!isAdmin(req, env))
    return unauthorized();
  const id = Number(req.params.id);
  if (!id)
    return json({ error: "bad_id" }, { status: 400 });
  const body = await readBody(req);
  const role = body.role === "admin" ? "admin" : "user";
  const r = await env.DB.prepare(
    "UPDATE users SET role = ? WHERE id = ?"
  ).bind(role, id).run();
  if (!r.meta || r.meta.changes === 0)
    return json({ error: "not_found" }, { status: 404 });
  return ok();
});
router.all("*", () => json({ error: "not_found" }, { status: 404 }));
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
