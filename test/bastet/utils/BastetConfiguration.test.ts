/*
 *   BASTET Program Analysis and Verification Framework
 *
 *   Copyright 2019 by University of Passau (uni-passau.de)
 *
 *   Maintained by Andreas Stahlbauer (firstname@lastname.net),
 *   see the file CONTRIBUTORS.md for the list of contributors.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */


import {BastetConfiguration} from "../../../src/bastet/utils/BastetConfiguration";

describe("BastetConfiguration", () => {

    test("reads typed values from the configured scope", () => {
        const cfg = new BastetConfiguration({
            foo: {
                count: 1,
                enabled: false,
                name: "analysis",
                labels: ["a", "b"],
                limits: [1, 2],
            },
        }, ["foo"]);

        expect(cfg.getNumberProperty("count")).toBe(1);
        expect(cfg.getBoolProperty("enabled", true)).toBe(false);
        expect(cfg.getStringProperty("name")).toBe("analysis");
        expect(cfg.getStringListProperty("labels")).toEqual(["a", "b"]);
        expect(cfg.getNumberListProperty("limits")).toEqual([1, 2]);
    });

    test("returns defaults for missing properties and scopes", () => {
        const missingProperty = new BastetConfiguration({foo: {}}, ["foo"]);
        const missingScope = new BastetConfiguration({}, ["foo", "bar"]);

        expect(missingProperty.getStringProperty("name", "default")).toBe("default");
        expect(missingScope.getNumberProperty("count", 42)).toBe(42);
    });

});
