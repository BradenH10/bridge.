import fs from "fs";
import { BASE_PATH } from "../constants";
import TabSystem from "../TabSystem";

let LIB = {
    $dynamic: {
        list: {
            next_index() {
                let arr = TabSystem.getSelected().content.get(TabSystem.getCurrentNavigation()).toJSON();
                if(Array.isArray(arr)) return arr.length + "";
                return "0";
            },
            index_pair() {
                let arr = TabSystem.getSelected().content.get(TabSystem.getCurrentNavigation()).toJSON();
                if(Array.isArray(arr)) return "1";
                return "0";
            },
            index_triple() {
                let arr = TabSystem.getSelected().content.get(TabSystem.getCurrentNavigation()).toJSON();
                if(Array.isArray(arr) && arr.length >= 2) return "2";
                if(Array.isArray(arr)) return "1";
                return "0";
            }
        },
        next_list_index() {
            console.warn("Usage of $dynamic.next_list_index is deprecated! Use $dynamic.list.next_index() instead!");
            return this.list.next_index();
        },
        loot_table_files() {
            return [];
        },
        trade_table_files() {
            return [];
        },
        entity: {
            component_groups() {
                return Object.keys(TabSystem.getSelected().content.get("minecraft:entity/component_groups").toJSON());
            },
            events() {
                return Object.keys(TabSystem.getSelected().content.get("minecraft:entity/events").toJSON());
            }
        }
    }
};
class Provider {
    constructor(current) {
        this.validator(current);
    }
    static loadAssets() {
        this.loadAsset("files")
            .then(files => files.forEach(
                f => this.loadAsset(f)
                    .then(data => LIB[f] = data)
            ));
    }
    static loadAsset(name) {
        return new Promise((resolve, reject) => {
            fs.readFile(__static + `/auto_completions/${name}.json`, (err, data) => {
                if(err) reject(err);
                resolve(JSON.parse(data.toString()));
            });
        });
    }

    validator(path) {
        path = path.replace(BASE_PATH, "");

        if(path.includes("entities")) return this.start_state = "entity";
        if(path.includes("loot_tables")) return this.start_state = "loot_table";
        if(path.includes("trading")) return this.start_state = "trade_table";
        if(path.includes("spawn_rules")) return this.start_state = "spawn_rule";
    }

    get(path) {
        path = path.replace("global", this.start_state);

        let propose = this.walk(path.split("/"));

        if(typeof propose == "string") {
            let prev_path = path.split("/");
            propose = this.omegaExpression(propose, prev_path.pop(), prev_path);
        }

        //console.log("[PROPOSING]", propose);
        if(propose === LIB) return { value: [], object: [] };
        if(Array.isArray(propose)) return { value: propose };

        //DYNAMIC LOAD INSTRUCTION
        if(propose.$load != undefined) {
            Object.assign(propose, this.omegaExpression(propose.$load));
            delete propose.$load;
        }

        return { 
            object: Object.keys(propose).filter(e => e != "$placeholder").map(key => {
                if(key[0] == "$") {
                    //console.log(this.omegaExpression(key))
                    let exp = this.omegaExpression(key);
                    if(typeof exp == "object") return Object.keys(exp)[0];
                    return exp;
                }
                return key;
            }) 
        };
    }

    walk(path_arr, current=LIB) {
        if(path_arr == undefined || path_arr.length == 0 || current == undefined) return current;
        let key = path_arr.shift();

        if(current[key] == undefined) {
            key = "$placeholder";
            if(current[key] == undefined && current !== LIB) {
                for(let k of Object.keys(current)) {
                    if(k[0] == "$") {
                        key = k;
                        break;
                    }
                }
            } 
        } 
        return this.walk(path_arr, current[key]);
    }

    omegaExpression(str, key, prev_path) {
        let parts = str.split(" and ");
        let result = [];
        parts.forEach(part => {
            let current;
            if(part.includes("$dynamic")) {
                current = this.dynamic(part);
                if(typeof current != "object") current = { [current]: {} };
            } else {
                current = this.static(part.substring(1, part.length));
            }

            if(!Array.isArray(current)) {
                if(Array.isArray(result)) result = {};
                // console.log(result, current)
                result = Object.assign(result, current);
            } else {
                result.push(...current);
            }
        });

        if(!str.includes("$dynamic")) this.walk(prev_path)[key] = result;
        return result;
    }

    //OMEGA HELPERS
    dynamic(expression) {
        let keys = expression.split(".");
        let current = LIB;
        while(keys.length > 0 && current != undefined) {
            current = current[keys.shift()];
            //console.log(current);
        }
        if(typeof current == "function") return current();
    }
    static(expression) {
        let current = LIB;
        // console.log(expression);
        expression.split(".").forEach(p => {
            if(current != undefined) current = current[p.replace(/\&dot\;/g, ".")];
        });
        return current;
    }
}
Provider.loadAssets();

export default Provider;