import { NotebookPanel } from "@jupyterlab/notebook";
import { Variable } from "./components/Variable";
import { ISignal, Signal } from "@phosphor/signaling";

import { NotebookUtilities } from "./NotebookUtilities";
import {
  DATA_LIST_KEY,
  FILE_PATH_KEY,
  GET_AXIS_INFO_CMD,
  GET_VARIABLES_CMD,
  REFRESH_VAR_CMD,
  SELECTED_VARIABLES_KEY,
  VARIABLE_SOURCES_KEY,
  VARIABLES_LOADED_KEY
} from "./constants";
import { Utilities } from "./Utilities";
import { AxisInfo } from "./components/AxisInfo";

export class VariableTracker {
  // Signals for use within components
  private _variablesChanged: Signal<this, Variable[]>;
  private _selectedVariablesChanged: Signal<this, string[]>;
  private _variableSourcesChanged: Signal<this, { [varName: string]: string }>;
  private _dataReaderListChanged: Signal<this, { [dataName: string]: string }>;

  private _isBusy: boolean;
  private _notebookPanel: NotebookPanel;
  private logErrorsToConsole: boolean; // Whether errors should log to console. Should be false during production.

  private _lastFileViewed: string; // The last file source that was used
  private _variableSources: { [varName: string]: string }; // Tracks what data reader each variable came from
  private _dataReaderList: { [dataName: string]: string }; // A dictionary containing data variable names and associated file path
  private _variables: Variable[];
  private _selectedVariables: string[];

  constructor() {
    this._notebookPanel = null;
    this._isBusy = false;
    this.logErrorsToConsole = true;

    this._lastFileViewed = "";
    this._variableSources = {};
    this._dataReaderList = {};
    this._variables = Array<Variable>();
    this._selectedVariables = Array<string>();
    this._variablesChanged = new Signal<this, Variable[]>(this);
    this._selectedVariablesChanged = new Signal<this, string[]>(this);
    this._variableSourcesChanged = new Signal<
      this,
      { [varName: string]: string }
    >(this);
    this._dataReaderListChanged = new Signal<
      this,
      { [dataName: string]: string }
    >(this);

    this.addVariable = this.addVariable.bind(this);
    this.getDataReaderName = this.getDataReaderName.bind(this);
    this.getFileVariables = this.getFileVariables.bind(this);
    this.loadMetaData = this.loadMetaData.bind(this);
    this.refreshVariables = this.refreshVariables.bind(this);
    this.setNotebook = this.setNotebook.bind(this);
    this.tryFilePath = this.tryFilePath.bind(this);
    this.updateAxesInfo = this.updateAxesInfo.bind(this);
    this.updateDimInfo = this.updateDimInfo.bind(this);
  }

  get isBusy(): boolean {
    return this._isBusy;
  }

  get notebookPanel(): NotebookPanel {
    return this._notebookPanel;
  }

  get variables(): Variable[] {
    return this._variables;
  }

  get variablesChanged(): Signal<this, Variable[]> {
    return this._variablesChanged;
  }

  set variables(newVariables: Variable[]) {
    this._variables = newVariables;
    this._variablesChanged.emit(this._variables);
  }

  get lastFileViewed(): string {
    return this._lastFileViewed;
  }

  set lastFileViewed(filePath: string) {
    this._lastFileViewed = filePath;
  }

  get dataReaderList(): { [dataName: string]: string } {
    return this._dataReaderList;
  }

  get dataReaderListChanged(): Signal<this, { [dataName: string]: string }> {
    return this._dataReaderListChanged;
  }

  get selectedVariables(): string[] {
    return this._selectedVariables;
  }

  get selectedVariablesChanged(): Signal<this, string[]> {
    return this._selectedVariablesChanged;
  }

  set selectedVariables(selection: string[]) {
    this._selectedVariables = selection;
    this._selectedVariablesChanged.emit(this._selectedVariables); // Publish that selected variables changed
  }

  get variableSources(): { [varName: string]: string } {
    return this._variableSources;
  }

  get variableSourcesChanged(): Signal<this, { [varName: string]: string }> {
    return this._variableSourcesChanged;
  }

  set variableSources(newSources: { [varName: string]: string }) {
    this._variableSources = newSources;
  }

  public async setNotebook(notebookPanel: NotebookPanel) {
    // Save meta data in previous notebook
    await this.saveMetaData();

    // Update to new notebook
    if (notebookPanel) {
      this._notebookPanel = notebookPanel;
      // Load any relevant meta data from new notebook
      this.loadMetaData();
    } else {
      this._notebookPanel = null;
    }
  }

  /**
   * @param readerName The name of the file reader to add
   * @param filePath The file path of the file to add to the reader
   */
  public async addDataSource(
    readerName: string,
    filePath: string
  ): Promise<void> {
    this.dataReaderList[readerName] = filePath;
  }

  /**
   * @description take a variable and load it into the notebook
   * @param variable The variable to load into the notebook
   */
  public async addVariable(variable: Variable): Promise<any> {
    // Save the source of the variable
    const newSource: { [varName: string]: string } = this.variableSources;
    newSource[variable.name] = variable.sourceName;
    this.variableSources = newSource;

    let currentVars: Variable[] = this.variables;

    // If no variables are in the list, update meta data and variables list
    if (!currentVars || currentVars.length < 1) {
      currentVars = Array<Variable>();
      currentVars.push(variable);
    } else {
      // If there are already variables stored, check if variable exists and replace if so
      let found: boolean = false;
      currentVars.forEach((storedVar: Variable, varIndex: number) => {
        if (storedVar.name === variable.name) {
          currentVars[varIndex] = variable;
          found = true;
        }
      });
      if (!found) {
        currentVars.push(variable);
      }
    }

    this.variables = currentVars;
  }

  public async saveMetaData() {
    if (this.notebookPanel) {
      // Save name of last file viewed in the notebook
      NotebookUtilities.setMetaData(
        this.notebookPanel,
        FILE_PATH_KEY,
        this._lastFileViewed
      );

      // Save data reader list to meta data
      NotebookUtilities.setMetaDataNow(
        this.notebookPanel,
        DATA_LIST_KEY,
        this.dataReaderList
      );

      // Save the selected variables inbto  meta data
      NotebookUtilities.setMetaDataNow(
        this.notebookPanel,
        SELECTED_VARIABLES_KEY,
        this.selectedVariables
      );

      // Save variables to meta data
      NotebookUtilities.setMetaDataNow(
        this.notebookPanel,
        VARIABLES_LOADED_KEY,
        this.variables
      );

      // Save the variable file sources
      NotebookUtilities.setMetaData(
        this.notebookPanel,
        VARIABLE_SOURCES_KEY,
        this._variableSources,
        true
      );

      await NotebookUtilities.saveNotebook(this.notebookPanel);
    }
  }

  public async loadMetaData() {
    await this.notebookPanel.activated;
    await this.notebookPanel.session.ready;

    // Update last file opened
    const lastSource: string | null = await NotebookUtilities.getMetaDataNow(
      this.notebookPanel,
      FILE_PATH_KEY
    );
    if (lastSource) {
      this.lastFileViewed = lastSource;
    } else {
      this.lastFileViewed = "";
    }

    // Update the loaded variables data from meta data
    let result: any = NotebookUtilities.getMetaDataNow(
      this.notebookPanel,
      VARIABLES_LOADED_KEY
    );
    if (result) {
      // Update the variables list
      this.variables = result;
    } else {
      this.variables = Array<Variable>();
    }

    // Update the variable sources from meta data
    result = NotebookUtilities.getMetaDataNow(
      this.notebookPanel,
      VARIABLE_SOURCES_KEY
    );
    if (result) {
      this.variableSources = result;
    } else {
      this.variableSources = {};
    }

    // Load the selected variables from meta data (if exists)
    const selection: string[] = NotebookUtilities.getMetaDataNow(
      this.notebookPanel,
      SELECTED_VARIABLES_KEY
    );
    // No meta data means fresh notebook with no selections
    if (!selection) {
      this._selectedVariables = selection;
    } else {
      this._selectedVariables = Array<string>();
    }

    // Update the list of data variables and associated filepath
    const readers: {
      [dataName: string]: string;
    } = NotebookUtilities.getMetaDataNow(this.notebookPanel, DATA_LIST_KEY);
    this._dataReaderList = readers ? readers : {};
  }

  // Will try to open a file path in cdms2. Returns true if successful.
  public async tryFilePath(filePath: string) {
    try {
      await NotebookUtilities.sendSimpleKernelRequest(
        this.notebookPanel,
        `tryOpenFile = cdms2.open('${filePath}')\ntryOpenFile.close()`,
        false
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the name for a data reader object to read data from a file. Creates a new name if one doesn't exist.
   * @param filePath The file path of the new file added
   */
  public getDataReaderName(filePath: string): string {
    // Check whether that file path is already open, return the data name if so
    let dataName: string = "";
    const found: boolean = Object.keys(this._dataReaderList).some(
      (dataVar: string) => {
        dataName = dataVar;
        return this._dataReaderList[dataVar] === filePath;
      }
    );
    if (found) {
      return dataName;
    }

    // Filepath hasn't been added before, create the name for data variable based on file path
    dataName = `${Utilities.createValidVarName(filePath)}_data`;

    // If the reader name already exist but the path is different (like for two files with
    // similar names but different paths) add a count to the end until it's unique
    let count: number = 1;
    let newName: string = dataName;

    while (Object.keys(this._dataReaderList).indexOf(newName) >= 0) {
      newName = `${dataName}${count}`;
      count += 1;
    }

    return newName;
  }

  /**
   * Opens a '.nc' file to read in it's variables via a kernel request.
   * @param filePath The file to open for variable reading
   * @returns Promise<Array<Variable>> -- A promise contianing an array of variables
   * that were found in the file.
   */
  public async getFileVariables(filePath: string): Promise<Variable[]> {
    if (!filePath) {
      return Array<Variable>();
    }

    try {
      // Get relative path for the file
      const nbPath: string = `${this.notebookPanel.session.path}`;
      const relativePath: string = Utilities.getRelativePath(nbPath, filePath);

      this._isBusy = true;
      const result: string = await NotebookUtilities.sendSimpleKernelRequest(
        this.notebookPanel,
        `import json\nimport cdms2\nreader = cdms2.open('${relativePath}')\n${GET_VARIABLES_CMD}`
      );
      this._isBusy = false;

      // Parse the resulting output into an object
      const variableAxes: any = JSON.parse(result.slice(1, result.length - 1));
      const newVars = Array<Variable>();
      Object.keys(variableAxes.vars).map((varName: string) => {
        const v = new Variable();
        v.name = varName;
        v.pythonID = variableAxes.vars[varName].pythonID;
        v.longName = variableAxes.vars[varName].name;
        v.axisList = variableAxes.vars[varName].axisList;
        v.axisInfo = Array<AxisInfo>();
        variableAxes.vars[varName].axisList.map((item: any) => {
          v.axisInfo.push(variableAxes.axes[item]);
        });
        v.units = variableAxes.vars[varName].units;
        v.sourceName = this.getDataReaderName(filePath);
        newVars.push(v);
      });
      return newVars;
    } catch (error) {
      return Array<Variable>();
    }
  }

  /**
   * This updates the current variable list by sending a command to the kernel directly.
   */
  public async refreshVariables(): Promise<void> {
    this._isBusy = true;
    // Get the variables info
    const result: string = await NotebookUtilities.sendSimpleKernelRequest(
      this.notebookPanel,
      REFRESH_VAR_CMD
    );
    this._isBusy = false;

    // A grouping object so that variables from each data source are updated
    const varGroups: { [sourceName: string]: Variable[] } = {};
    // Parse the resulting output into a list of variables with basic data
    const variableInfo: any = JSON.parse(result.slice(1, result.length - 1));

    // Exit early if no variables exist
    if (Object.keys(variableInfo).length < 1) {
      this.variables = Array<Variable>();
      return;
    }

    const newVars = Array<Variable>();
    let srcName: string;
    Object.keys(variableInfo).map(async (item: string) => {
      const v: Variable = new Variable();
      v.name = item;
      v.pythonID = variableInfo[item].pythonID;
      v.longName = variableInfo[item].name;
      v.axisList = variableInfo[item].axisList;
      v.axisInfo = Array<AxisInfo>();
      v.units = variableInfo[item].units;

      // Update the parent data source
      srcName = this.variableSources[v.name];
      if (srcName) {
        v.sourceName = srcName;
        if (varGroups[v.sourceName]) {
          varGroups[v.sourceName].push(v);
        } else {
          // If this source hasn't been initialized, initialize it
          varGroups[v.sourceName] = Array<Variable>();
          varGroups[v.sourceName].push(v);
        }
      } else {
        v.sourceName = "";
      }

      newVars.push(v);
    });

    // Update axis info for each variable
    if (varGroups) {
      Object.keys(varGroups).forEach(async (sourceName: string) => {
        await this.updateAxesInfo(varGroups[sourceName]);
      });
    }

    this.variables = newVars;
  }

  // Updates the axes information for each variable based on what source it came from
  public async updateAxesInfo(varGroup: Variable[]): Promise<void> {
    // Get the filepath from the data readerlist
    const sourceFile: string = this._dataReaderList[varGroup[0].sourceName];

    // Exit early if no source filepath exists
    if (!sourceFile) {
      return;
    }

    // Get relative path for the file
    const nbPath: string = `${this.notebookPanel.session.path}`;
    const relativePath: string = Utilities.getRelativePath(nbPath, sourceFile);

    let cmd: string = `import cdms2\nimport json\nreader = cdms2.open('${relativePath}')`;
    cmd += `\n${GET_AXIS_INFO_CMD}\nreader.close()\n`;

    this._isBusy = true;
    // Get the variables info
    const result: string = await NotebookUtilities.sendSimpleKernelRequest(
      this.notebookPanel,
      cmd
    );
    this._isBusy = false;

    // Parse the resulting output as file specific axes
    const axesInfo: any = JSON.parse(result.slice(1, result.length - 1));

    // Update axes info for each variable in the group
    varGroup.forEach((variable: Variable) => {
      variable.axisList.map((item: any) => {
        if (axesInfo[item].data) {
          axesInfo[item].min = axesInfo[item].data[0];
          axesInfo[item].max =
            axesInfo[item].data[axesInfo[item].data.length - 1];
          variable.axisInfo.push(axesInfo[item]);
        }
      });
    });
  }

  /**
   * @param newInfo new dimension info for the variables axis
   * @param varName the name of the variable to update
   */
  public async updateDimInfo(newInfo: any, varName: string): Promise<void> {
    const newVariables: Variable[] = this._variables;
    newVariables.forEach((variable: Variable, varIndex: number) => {
      if (variable.name !== varName) {
        return;
      }
      variable.axisInfo.forEach((axis: AxisInfo, axisIndex: number) => {
        if (axis.name !== newInfo.name) {
          return;
        }
        newVariables[varIndex].axisInfo[axisIndex].min = newInfo.min;
        newVariables[varIndex].axisInfo[axisIndex].max = newInfo.max;
      });
    });
    this.variables = newVariables;
  }
}
