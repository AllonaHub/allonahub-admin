"use strict";

const assert = require("node:assert/strict");
const localizer = require("../js/maritime-cv-value-localizer.js");

assert.equal(localizer.localize("Matros", "en", "semantic"), "Ordinary Seaman");
assert.equal(localizer.localize("Aşpaz", "en", "semantic"), "Cook");
assert.equal(localizer.localize("Kaptan", "en", "semantic"), "Captain");
assert.equal(localizer.localize("Azərbaycanlı", "en", "semantic"), "Azerbaijani");
assert.equal(localizer.localize("Kişi", "en", "semantic"), "Male");
assert.equal(localizer.localize("Subay", "en", "semantic"), "Single");
assert.equal(localizer.localize("Bakı", "en", "proper"), "Baku");
assert.equal(localizer.localize("Növbə motorçusu", "az", "semantic"), "Növbə motorçusu");
assert.equal(localizer.localize("Növbə motorçusu", "en", "semantic"), "Motorman");
assert.equal(localizer.localize("Gülablı kəndi, Ağdam, Azərbaycan", "az", "freeText"), "Gülablı kəndi, Ağdam, Azərbaycan");
assert.equal(localizer.localize("Ağdam, Azərbaycan", "en", "proper"), "Aghdam, Azerbaijan");
assert.equal(localizer.localize("Gülablı kəndi, Ağdam, Azərbaycan", "en", "freeText"), "Gulabli kandi, Aghdam, Azerbaijan");

assert.equal(localizer.localize("Aşpazov", "en", "name"), "Ashpazov");
assert.equal(localizer.localize("Şehriyar", "en", "name"), "Shehriyar");
assert.equal(localizer.localize("Şıhmemmed", "en", "name"), "Shihmemmed");
assert.equal(localizer.localize("Şehriyar", "ru", "name"), "Шехрияр");

assert.equal(localizer.localize("C03358710", "ru", "identifier"), "C03358710");
assert.equal(localizer.localize("crew@example.com", "ru", "contact"), "crew@example.com");

console.log("Maritime CV value localization tests passed.");
