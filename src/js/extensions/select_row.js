var SelectRow = function(table){

	var extension = {
		table:table, //hold Tabulator object

		selecting:false, //flag selecting in progress
		selectPrev:[], //hold previously selected element for drag drop selection

		selectedRows:[], //hold selected rows

		initializeRow:function(row){
			var self = this,
			element = row.getElement();

			// trigger end of row selection
			var endSelect = function(){

				setTimeout(function(){
					self.selecting = false;
				}, 50)

				$("body").off("mouseup", endSelect);
			}


			row.extensions.select = {selected:false};

			//set row selection class
			if(self.table.options.selectableCheck(row.getData(), element)){
				element.addClass("tabulator-selectable").removeClass("tabulator-unselectable");

				if(self.table.options.selectable && self.table.options.selectable != "highlight"){
					element.on("click", function(e){
						if(!self.selecting){
							self.toggleRow(row);
						}
					});

					element.on("mousedown", function(e){
						if(e.shiftKey){
							self.selecting = true;

							self.selectPrev = [];

							$("body").on("mouseup", endSelect);
							$("body").on("keyup", endSelect);

							self.toggleRow(row);

							return false;
						}
					});

					element.on("mouseenter", function(e){
						if(self.selecting){
							self.toggleRow(row);

							if(self.selectPrev[1] == row){
								self.toggleRow(self.selectPrev[0]);
							}
						}
					});

					element.on("mouseout", function(e){
						if(self.selecting){
							self.selectPrev.unshift(row);
						}
					});
				}

			}else{
				row.getElement().addClass("tabulator-unselectable").removeClass("tabulator-selectable");
			}

		},

		//toggle row selection
		toggleRow:function(row){
			if(this.table.options.selectableCheck(row.getData(), row.getElement())){
				if(row.extensions.select.selected){
					this._deselectRow(row);
				}else{
					this._selectRow(row);
				}
			}
		},

		//select a number of rows
		selectRows:function(rows){
			var self = this;

			if(typeof rows == "undefined"){
				self.table.rowManager.rows.forEach(function(row){
					self._selectRow(row, true);
				});

				self._rowSelectionChanged();
			}else{
				if(Array.isArray(rows)){
					rows.forEach(function(row){
						self._selectRow(row, true);
					});

					self._rowSelectionChanged();
				}else{
					self._selectRow(rows);
				}
			}
		},

		//select an individual row
		_selectRow:function(rowInfo, silent){
			var self = this,
			index;

			var row = self.table.rowManager.findRow(rowInfo);

			if(row){
				var self = this;

				row.extensions.select.selected = true;
				row.getElement().addClass("tabulator-selected");

				self.selectedRows.push(row);

				if(!silent){
					self._rowSelectionChanged();
				}
			}else{
				console.warn("Selection Error - No such row found, ignoring selection:" + rowInfo)
			}
		},

		//deselect a number of rows
		deselectRows:function(rows){
			var self = this;

			if(typeof rows == "undefined"){

				let rowCount = self.selectedRows.length;

				for(let i = 0; i < rowCount; i++){
					self._deselectRow(self.selectedRows[0], true);
				}

				self._rowSelectionChanged();
			}else{
				if(Array.isArray(rows)){
					rows.forEach(function(row){
						self._deselectRow(row, true);
					});

					self._rowSelectionChanged();
				}else{
					self._deselectRow(rows);
				}
			}
		},

		//deselect an individual row
		_deselectRow:function(rowInfo, silent){
			var self = this,
			index;
			var row = self.table.rowManager.findRow(rowInfo);

			if(row){
				index = self.selectedRows.findIndex(function(selectedRow){
					return selectedRow = row;
				});

				if(index > -1){

					row.extensions.select.selected = false;
					row.getElement().removeClass("tabulator-selected");
					self.selectedRows.splice(index, 1);

					if(!silent){
						self._rowSelectionChanged();
					}
				}
			}else{
				console.warn("Selection Error - No such row found, ignoring selection:" + rowInfo)
			}
		},

		getSelectedData:function(){
			var data = [];

			this.selectedRows.forEach(function(row){
				data.push(row.getData());
			});

			return data
		},

		getSelectedRows:function(){
			return this.selectedRows;
		},

		_rowSelectionChanged:function(){
			this.table.options.rowSelectionChanged(this.getSelectedData(), this.getSelectedRows());
		},

	}

	return extension;
}

Tabulator.registerExtension("selectRow", SelectRow);