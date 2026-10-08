import { Component, ChangeDetectionStrategy } from "@angular/core";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { TextQuestionPopupComponent } from "../../../components/text-question-popup/text-question-popup/text-question-popup.component";
import { filter, first, map, switchMap, withLatestFrom } from "rxjs/operators";
import { Clipboard } from "@angular/cdk/clipboard";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalService } from "ng-zorro-antd/modal";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { RosterService } from "../../../core/database/services/roster.service";
import { Roster } from "../../../model/roster";
import { arrayRemove } from "firebase/firestore";
import { AuthService } from "../../../core/database/services/auth.service";
import { CompletionService } from "../../../core/database/services/completion.service";
import { EnergyService } from "../../../core/database/services/energy.service";
import { combineLatest, of } from "rxjs";
import { LostarkClass } from "../../../model/character/lostark-class";
import { Character } from "../../../model/character/character";
import { countWeeklyGoldCharacters, getWeeklyGoldLimitWarning, isWeeklyGoldTickDisabled, newCharacterWeeklyGold } from "../../../core/weekly-gold";
import { characterNameError, cleanCharacterName, MAX_CHARACTER_ILVL, MAX_CHARACTER_NAME_LENGTH, nextCharacterId, parseRosterImport } from "../../../core/roster-input";
import { SettingsService } from "../../../core/database/services/settings.service";
import { characterKeyMigrationWrites } from "../../../core/character-keys";
import { importErrorMessage } from "../../../core/import-errors";

/** The part of NgModel the inputs use to show a value again after a rejected edit. */
interface ResettableModel {
  reset(value?: unknown): void;
}

@Component({
  selector: "lostark-helper-roster",
  templateUrl: "./roster.component.html",
  styleUrls: ["./roster.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class RosterComponent {

  public LostarkClass = LostarkClass;

  public classes = Object.keys(LostarkClass)
    .filter(key => !isNaN(+key) && !LostarkClass[key].startsWith("UNRELEASED"))
    .map(key => {
      return {
        // Numbers, as classes are stored (a string option would not match a stored class)
        id: +key,
        name: `${LostarkClass[key][0]}${LostarkClass[key].slice(1).toLowerCase()}`,
        icon: `class_${key.padStart(2, "0")}.png`
      };
    });

  public roster$ = this.rosterService.roster$;

  public readonly maxNameLength = MAX_CHARACTER_NAME_LENGTH;

  public readonly maxIlvl = MAX_CHARACTER_ILVL;

  public form = this.fb.group({
    name: ["", [Validators.required, Validators.pattern(/\S/), Validators.maxLength(MAX_CHARACTER_NAME_LENGTH)]],
    ilvl: [null, [Validators.required, Validators.min(0), Validators.max(MAX_CHARACTER_ILVL)]],
    lazy: [false],
    class: [null, Validators.required]
  });

  public hasLocalstorageRoster = localStorage.getItem("roster") !== null;

  constructor(private rosterService: RosterService,
              private auth: AuthService,
              private fb: UntypedFormBuilder,
              private clipboard: Clipboard,
              private message: NzMessageService,
              private completionService: CompletionService,
              private energyService: EnergyService,
              private modal: NzModalService,
              private settings: SettingsService) {
  }

  public addCharacter(roster: Roster): void {
    const form = this.form.getRawValue();
    const name = cleanCharacterName(form.name);
    const nameError = characterNameError(name, roster.characters);
    if (nameError) {
      this.message.error(nameError);
      return;
    }
    roster.characters.push({
      id: nextCharacterId(roster.characters),
      name,
      ilvl: form.ilvl,
      lazy: form.lazy,
      class: form.class,
      weeklyGold: newCharacterWeeklyGold(roster.characters),
      tickets: {
        EbonyCubeLevel1: 0,
        EbonyCubeLevel2: 0,
        EbonyCubeLevel3: 0,
        EbonyCubeLevel4: 0,
        EbonyCubeLevel5: 0,
        EbonyCube1stUnlock: 0,
        EbonyCube2ndUnlock: 0,
        EbonyCube3rdUnlock: 0,
        EbonyCube4thUnlock: 0
      }
    });
    this.form.reset();
    this.rosterService.setOne(roster.$key, roster);
  }

  public removeCharacter(character: Character, roster: Roster): void {
    this.rosterService.updateOne(roster.$key, {
      characters: arrayRemove(character)
    });
  }

  public saveCharacterName(character: Character, roster: Roster, newName: string, nameModel: ResettableModel): void {
    const name = cleanCharacterName(newName);
    if (name === character.name) {
      // Only spaces or invisible characters were added: show the saved name again
      nameModel.reset(character.name);
      return;
    }
    const nameError = characterNameError(name, roster.characters, character.id);
    if (nameError) {
      nameModel.reset(character.name);
      this.message.error(nameError);
      return;
    }
    // Keys saved under the old name (from older data) move to the character id before the name changes
    const isOldNameKey = (key: string) => key.split(":")[0] === character.name;
    combineLatest([
      this.completionService.completion$,
      this.energyService.energy$,
      this.settings.settings$
    ]).pipe(
      first(),
      switchMap(([completion, energy, settings]) => {
        const settingsWrites = characterKeyMigrationWrites(settings as unknown as Record<string, unknown>, [character]);
        if (settingsWrites.length > 0) {
          this.settings.patchFields(settings.$key, settingsWrites);
        }
        let updated = false;
        Object.keys(completion.data).filter(isOldNameKey).forEach(key => {
          updated = true;
          completion.data[`${character.id}:${key.split(":")[1]}`] = completion.data[key];
          delete completion.data[key];
        });
        Object.keys(energy.data).filter(isOldNameKey).forEach(key => {
          updated = true;
          energy.data[`${character.id}:${key.split(":")[1]}`] = energy.data[key];
          delete energy.data[key];
        });
        if (updated) {
          return combineLatest([
            this.completionService.setOne(completion.$key, completion),
            this.energyService.setOne(energy.$key, energy)
          ]);
        }
        return of(null);
      })
    ).subscribe();
    this.saveCharacter({ ...character, name }, roster);
  }

  public saveIlvl(character: Character, roster: Roster, value: number | null, ilvlModel: ResettableModel): void {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_CHARACTER_ILVL) {
      ilvlModel.reset(character.ilvl);
      return;
    }
    character.ilvl = value;
    this.saveCharacter(character, roster);
  }

  public saveCharacter(character: Character, roster: Roster): void {
    // Only a unique id may be matched: an id used twice would overwrite the other character
    if (!character.id || roster.characters.filter(char => char.id === character.id).length !== 1) {
      this.message.error("This character could not be saved. Reload the page and try again.");
      return;
    }
    this.rosterService.updateOne(roster.$key, {
      characters: roster.characters.map(char => char.id === character.id ? character : char)
    });
  }

  exportRoster(roster: Roster): void {
    this.clipboard.copy(JSON.stringify(roster));
    this.message.success("Roster copied to your clipboard");
  }

  importRoster(): void {
    this.modal.create({
      nzTitle: "Import roster",
      nzContent: TextQuestionPopupComponent,
      nzData: {
        placeholder: "Paste your exported roster here",
        description: "This replaces all characters in your roster."
      },
      nzFooter: null
    }).afterClose
      .pipe(
        // Closing the popup without submitting gives no text
        filter((text): text is string => !!text),
        map(text => parseRosterImport(text)),
        filter(result => {
          if (!result.ok) {
            this.message.error(importErrorMessage(result.errors), { nzDuration: 10000 });
          }
          return result.ok;
        }),
        withLatestFrom(this.auth.uid$),
        switchMap(([result, uid]) => this.rosterService.updateOne(uid, { characters: result.characters }))
      )
      .subscribe({
        next: () => {
          this.message.success("Roster imported");
        },
        error: e => {
          this.message.error((e as Error).message || String(e));
        }
      });
  }

  importFromLocalStorage(uid: string): void {
    const characters = JSON.parse(localStorage.getItem("roster") || "[]") as Character[];
    this.rosterService.setOne(uid, { characters, trackedTasks: {}, showAllTasks: false });
    localStorage.removeItem("roster");
    this.hasLocalstorageRoster = false;
  }

  isWeeklyGoldTickDisabled(roster: Roster, character: Character): boolean {
    return isWeeklyGoldTickDisabled(roster.characters, character);
  }

  weeklyGoldLimitWarning(roster: Roster): string | undefined {
    return getWeeklyGoldLimitWarning(countWeeklyGoldCharacters(roster.characters));
  }

  trackByCharacter(index: number, character: Character): number | string {
    return character.id ?? character.name;
  }

  drop(roster: Roster, event: CdkDragDrop<Character[], Character>): void {
    moveItemInArray(roster.characters, event.previousIndex, event.currentIndex);
    roster.characters = roster.characters.map((c, i) => {
      return {
        ...c,
        index: i
      };
    });
    this.rosterService.updateOne(roster.$key, { characters: roster.characters });
  }

  /** Arrow Up or Down on a row's grip moves the row one place, as a drop would, and keeps the grip focused. */
  moveByKeyboard(roster: Roster, index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= roster.characters.length) {
      return;
    }
    const id = roster.characters[index].id;
    this.drop(roster, { previousIndex: index, currentIndex: target } as CdkDragDrop<Character[], Character>);
    setTimeout(() => document.querySelector<HTMLElement>(`.drag-handle[data-character-id="${id}"]`)?.focus());
  }
}
