/** Official Phosphor regular SVGs; presentation only, no authority. MIT. */
import svg0 from "@phosphor-icons/core/assets/regular/sun.svg?raw";
import svg1 from "@phosphor-icons/core/assets/regular/check-square.svg?raw";
import svg2 from "@phosphor-icons/core/assets/regular/notebook.svg?raw";
import svg3 from "@phosphor-icons/core/assets/regular/calendar-blank.svg?raw";
import svg4 from "@phosphor-icons/core/assets/regular/plant.svg?raw";
import svg5 from "@phosphor-icons/core/assets/regular/stack.svg?raw";
import svg6 from "@phosphor-icons/core/assets/regular/graduation-cap.svg?raw";
import svg7 from "@phosphor-icons/core/assets/regular/compass.svg?raw";
import svg8 from "@phosphor-icons/core/assets/regular/gear.svg?raw";
import svg9 from "@phosphor-icons/core/assets/regular/arrow-clockwise.svg?raw";
import svg10 from "@phosphor-icons/core/assets/regular/plus.svg?raw";
import svg11 from "@phosphor-icons/core/assets/regular/check.svg?raw";
import svg12 from "@phosphor-icons/core/assets/regular/dots-three.svg?raw";
import svg13 from "@phosphor-icons/core/assets/regular/arrow-up-right.svg?raw";
import svg14 from "@phosphor-icons/core/assets/regular/arrow-left.svg?raw";
import svg15 from "@phosphor-icons/core/assets/regular/arrow-right.svg?raw";
import svg16 from "@phosphor-icons/core/assets/regular/x.svg?raw";
import svg17 from "@phosphor-icons/core/assets/regular/download-simple.svg?raw";
import svg18 from "@phosphor-icons/core/assets/regular/translate.svg?raw";
import svg19 from "@phosphor-icons/core/assets/regular/repeat.svg?raw";
import svg20 from "@phosphor-icons/core/assets/regular/caret-down.svg?raw";
import svg21 from "@phosphor-icons/core/assets/regular/circle.svg?raw";
import svg22 from "@phosphor-icons/core/assets/regular/floppy-disk.svg?raw";
import svg23 from "@phosphor-icons/core/assets/regular/trash.svg?raw";
const assets:Record<string,string>={"sun":svg0,"check-square":svg1,"notebook":svg2,"calendar-blank":svg3,"plant":svg4,"stack":svg5,"graduation-cap":svg6,"compass":svg7,"gear":svg8,"arrow-clockwise":svg9,"plus":svg10,"check":svg11,"dots-three":svg12,"arrow-up-right":svg13,"arrow-left":svg14,"arrow-right":svg15,"x":svg16,"download-simple":svg17,"translate":svg18,"repeat":svg19,"caret-down":svg20,"circle":svg21,"floppy-disk":svg22,"trash":svg23};
export function icon(name:string){return (assets[name]||assets.circle).replace('<svg ', '<svg aria-hidden="true" focusable="false" ')}
