import Module from '../../core/Module.js';

import CalcComponent from './CalcComponent.js';

import Cell from '../../core/cell/Cell.js';
import Column from '../../core/column/Column.js';
import Row from '../../core/row/Row.js';

import defaultCalculations from './defaults/calculations.js';

class ColumnCalcs extends Module{

	constructor(table){
		super(table);

		this.topCalcs = [];
		this.botCalcs = [];
		this.genColumn = false;
		this.topElement = this.createElement();
		this.botElement = this.createElement();
		this.topRow = false;
		this.botRow = false;
		this.topInitialized = false;
		this.botInitialized = false;
	}

	createElement (){
		var el = document.createElement("div");
		el.classList.add("tabulator-calcs-holder");
		return el;
	}

	initialize(){
		this.genColumn = new Column({field:"value"}, this);

		this.subscribe("cell-value-changed", this.cellValueChanged.bind(this));
		this.subscribe("column-init", this.initializeColumnCheck.bind(this));
		this.subscribe("row-deleted", this.rowsUpdated.bind(this));
		this.subscribe("scroll-horizontal", this.scrollHorizontal.bind(this));
		this.subscribe("row-added", this.rowsUpdated.bind(this));
		this.subscribe("column-moved", this.recalcActiveRows.bind(this));
		this.subscribe("column-add", this.recalcActiveRows.bind(this));

		this.registerTableFunction("getCalcResults", this.getResults.bind(this));
		this.registerTableFunction("recalc", this.userRecalc.bind(this));
	}

	///////////////////////////////////
	///////// Table Functions /////////
	///////////////////////////////////
	userRecalc(){
		this.recalcAll(this.table.rowManager.activeRows);
	}

	///////////////////////////////////
	///////// Internal Logic //////////
	///////////////////////////////////

	rowsUpdated(row){
		if(this.table.options.groupBy){
			this.recalcRowGroup(this);
		}else{
			this.recalcActiveRows();
		}
	}

	recalcActiveRows(){
		this.recalc(this.table.rowManager.activeRows);
	}

	cellValueChanged(cell){
		if(cell.column.definition.topCalc || cell.column.definition.bottomCalc){
			if(this.table.options.groupBy){

				if(this.table.options.columnCalcs == "table" || this.table.options.columnCalcs == "both"){
					this.recalcActiveRows();
				}

				if(this.table.options.columnCalcs != "table"){
					this.recalcRowGroup(cell.row);
				}

			}else{
				this.recalcActiveRows();
			}
		}
	}

	initializeColumnCheck(column){
		if(column.definition.topCalc || column.definition.bottomCalc){
			this.initializeColumn(column);
		}
	}

	//initialize column calcs
	initializeColumn(column){
		var def = column.definition

		var config = {
			topCalcParams:def.topCalcParams || {},
			botCalcParams:def.bottomCalcParams || {},
		};

		if(def.topCalc){

			switch(typeof def.topCalc){
				case "string":
				if(ColumnCalcs.calculations[def.topCalc]){
					config.topCalc = ColumnCalcs.calculations[def.topCalc]
				}else{
					console.warn("Column Calc Error - No such calculation found, ignoring: ", def.topCalc);
				}
				break;

				case "function":
				config.topCalc = def.topCalc;
				break

			}

			if(config.topCalc){
				column.modules.columnCalcs = config;
				this.topCalcs.push(column);

				if(this.table.options.columnCalcs != "group"){
					this.initializeTopRow();
				}
			}

		}

		if(def.bottomCalc){
			switch(typeof def.bottomCalc){
				case "string":
				if(ColumnCalcs.calculations[def.bottomCalc]){
					config.botCalc = ColumnCalcs.calculations[def.bottomCalc]
				}else{
					console.warn("Column Calc Error - No such calculation found, ignoring: ", def.bottomCalc);
				}
				break;

				case "function":
				config.botCalc = def.bottomCalc;
				break

			}

			if(config.botCalc){
				column.modules.columnCalcs = config;
				this.botCalcs.push(column);

				if(this.table.options.columnCalcs != "group"){
					this.initializeBottomRow();
				}
			}
		}

	}

	//dummy functions to handle being mock column manager
	registerColumnField(){};

	removeCalcs(){
		var changed = false;

		if(this.topInitialized){
			this.topInitialized = false;
			this.topElement.parentNode.removeChild(this.topElement);
			changed = true;
		}

		if(this.botInitialized){
			this.botInitialized = false;
			this.table.footerManager.remove(this.botElement);
			changed = true;
		}

		if(changed){
			this.table.rowManager.adjustTableSize();
		}
	}

	initializeTopRow(){
		if(!this.topInitialized){
			this.table.columnManager.getElement().insertBefore(this.topElement, this.table.columnManager.headersElement.nextSibling);
			this.topInitialized = true;
		}
	}

	initializeBottomRow(){
		if(!this.botInitialized){
			this.table.footerManager.prepend(this.botElement);
			this.botInitialized = true;
		}
	}

	scrollHorizontal(left){
		if(this.botInitialized && this.botRow){
			this.botRow.getElement().style.marginLeft = (-left) + "px";
		}
	}

	recalc(rows){
		var data, row;

		if(this.topInitialized || this.botInitialized){
			data = this.rowsToData(rows);

			if(this.topInitialized){
				if(this.topRow){
					this.topRow.deleteCells();
				}

				row = this.generateRow("top", this.rowsToData(rows))
				this.topRow = row;
				while(this.topElement.firstChild) this.topElement.removeChild(this.topElement.firstChild);
				this.topElement.appendChild(row.getElement());
				row.initialize(true);
			}

			if(this.botInitialized){
				if(this.botRow){
					this.botRow.deleteCells();
				}

				row = this.generateRow("bottom", this.rowsToData(rows))
				this.botRow = row;
				while(this.botElement.firstChild) this.botElement.removeChild(this.botElement.firstChild);
				this.botElement.appendChild(row.getElement());
				row.initialize(true);
			}

			this.table.rowManager.adjustTableSize();

			//set resizable handles
			if(this.table.modExists("frozenColumns")){
				this.table.modules.frozenColumns.layout();
			}
		}
	}

	recalcRowGroup(row){
		this.recalcGroup(this.table.modules.groupRows.getRowGroup(row));
	}

	recalcAll(){
		if(this.topCalcs.length || this.botCalcs.length){
			if(this.table.options.columnCalcs !== "group"){
				this.recalcActiveRows();
			}

			if(this.table.options.groupBy && this.table.options.columnCalcs !== "table"){


				var groups = table.modules.groupRows.getChildGroups();

				groups.forEach((group) => {
					this.recalcGroup(group);
				});
			}
		}
	}

	recalcGroup(group){
		var data, rowData;

		if(group){
			if(group.calcs){
				if(group.calcs.bottom){
					data = this.rowsToData(group.rows);
					rowData = this.generateRowData("bottom", data);

					group.calcs.bottom.updateData(rowData);
					group.calcs.bottom.reinitialize();
				}

				if(group.calcs.top){
					data = this.rowsToData(group.rows);
					rowData = this.generateRowData("top", data);

					group.calcs.top.updateData(rowData);
					group.calcs.top.reinitialize();
				}
			}
		}
	}

	//generate top stats row
	generateTopRow(rows){
		return this.generateRow("top", this.rowsToData(rows));
	}
	//generate bottom stats row
	generateBottomRow(rows){
		return this.generateRow("bottom", this.rowsToData(rows));
	}

	rowsToData(rows){
		var data = [];

		rows.forEach((row) => {
			data.push(row.getData());

			if(this.table.options.dataTree && this.table.options.dataTreeChildColumnCalcs){
				if(row.modules.dataTree.open){
					var children = this.rowsToData(this.table.modules.dataTree.getFilteredTreeChildren(row));
					data = data.concat(children);
				}
			}
		});

		return data;
	}

	//generate stats row
	generateRow(pos, data){
		var rowData = this.generateRowData(pos, data),
		row;

		if(this.table.modExists("mutator")){
			this.table.modules.mutator.disable();
		}

		row = new Row(rowData, this, "calc");

		if(this.table.modExists("mutator")){
			this.table.modules.mutator.enable();
		}

		row.getElement().classList.add("tabulator-calcs", "tabulator-calcs-" + pos);

		row.component = false;

		row.getComponent = () => {
			if(!row.component){
				row.component = new CalcComponent(this);
			}

			return row.component;
		};

		row.generateCells = () => {

			var cells = [];

			this.table.columnManager.columnsByIndex.forEach((column) => {

					//set field name of mock column
					this.genColumn.setField(column.getField());
					this.genColumn.hozAlign = column.hozAlign;

					if(column.definition[pos + "CalcFormatter"] && this.table.modExists("format")){
						this.genColumn.modules.format = {
							formatter: this.table.modules.format.getFormatter(column.definition[pos + "CalcFormatter"]),
							params: column.definition[pos + "CalcFormatterParams"] || {},
						};
					}else{
						this.genColumn.modules.format = {
							formatter: this.table.modules.format.getFormatter("plaintext"),
							params:{}
						};
					}

					//ensure css class defintion is replicated to calculation cell
					this.genColumn.definition.cssClass = column.definition.cssClass;

					//generate cell and assign to correct column
					var cell = new Cell(this.genColumn, row);
					cell.getElement();
					cell.column = column;
					cell.setWidth();

					column.cells.push(cell);
					cells.push(cell);

					if(!column.visible){
						cell.hide();
					}
				});

			row.cells = cells;
		};

		return row;
	}

	//generate stats row
	generateRowData(pos, data){
		var rowData = {},
		calcs = pos == "top" ? this.topCalcs : this.botCalcs,
		type = pos == "top" ? "topCalc" : "botCalc",
		params, paramKey;

		calcs.forEach(function(column){
			var values = [];

			if(column.modules.columnCalcs && column.modules.columnCalcs[type]){
				data.forEach(function(item){
					values.push(column.getFieldValue(item));
				});

				paramKey = type + "Params";
				params = typeof column.modules.columnCalcs[paramKey] === "function" ? column.modules.columnCalcs[paramKey](values, data) : column.modules.columnCalcs[paramKey];

				column.setFieldValue(rowData, column.modules.columnCalcs[type](values, data, params));
			}
		});

		return rowData;
	}

	hasTopCalcs(){
		return	!!(this.topCalcs.length);
	}

	hasBottomCalcs(){
		return	!!(this.botCalcs.length);
	}

	//handle table redraw
	redraw(){
		if(this.topRow){
			this.topRow.normalizeHeight(true);
		}
		if(this.botRow){
			this.botRow.normalizeHeight(true);
		}
	}

	//return the calculated
	getResults(){
		var results = {},
		groups;

		if(this.table.options.groupBy && this.table.modExists("groupRows")){
			groups = this.table.modules.groupRows.getGroups(true);

			groups.forEach((group) => {
				results[group.getKey()] = this.getGroupResults(group);
			});
		}else{
			results = {
				top: this.topRow ? this.topRow.getData() : {},
				bottom: this.botRow ? this.botRow.getData() : {},
			}
		}

		return results;
	}

	//get results from a group
	getGroupResults(group){
		var groupObj = group._getSelf(),
		subGroups = group.getSubGroups(),
		subGroupResults = {},
		results = {};

		subGroups.forEach((subgroup) => {
			subGroupResults[subgroup.getKey()] = this.getGroupResults(subgroup);
		});

		results = {
			top: groupObj.calcs.top ? groupObj.calcs.top.getData() : {},
			bottom: groupObj.calcs.bottom ? groupObj.calcs.bottom.getData() : {},
			groups: subGroupResults,
		}

		return results;
	}
}

ColumnCalcs.moduleName = "columnCalcs";

//load defaults
ColumnCalcs.calculations = defaultCalculations;

export default ColumnCalcs;