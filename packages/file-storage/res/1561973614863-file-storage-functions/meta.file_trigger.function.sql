-- file_validate function sets the entityId of a file if not already set or deleted
CREATE OR REPLACE FUNCTION _meta.file_trigger() RETURNS trigger AS $$

    function validateFile(fileName, entityId, types) {
    	if (fileName == null || fileName.length < 39) {
    		throw new Error('Invalid fileName.');
    	}
        try {
            var fileNameWithoutExtension = fileName.split('.')[0].split('-');
            var fileType = fileNameWithoutExtension.pop();
            var fileId = fileNameWithoutExtension.join('-');
        } catch (e) {
            throw new Error('Invalid fileName.');
        }
        var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(fileId) !== true) {
        	throw new Error('Invalid fileName. No UUID.');
        }
        
        if (uuidRegex.test(entityId) !== true) {
        	throw new Error('Invalid entityId. No UUID.');
        }

        var plan = plv8.prepare( 'SELECT _meta."file_validate"($1, $2, $3::TEXT[]);', ['TEXT', 'uuid', 'TEXT[]'] );
        var rows = plan.execute( [fileName, entityId, types] );
    }

    function invalidateFile(fileName, entityId) {
    	if (fileName == null || fileName.length < 39) {
    		throw new Error('Invalid fileName.');
    	}
        try {
            var fileNameWithoutExtension = fileName.split('.')[0].split('-');
            var fileType = fileNameWithoutExtension.pop();
            var fileId = fileNameWithoutExtension.join('-');
        } catch (e) {
            throw new Error('Invalid fileName.');
        }
        var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(fileId) !== true) {
        	throw new Error('Invalid fileName. No UUID.');
        }
        
        if (uuidRegex.test(entityId) !== true) {
        	throw new Error('Invalid entityId. No UUID.');
        }

        var plan = plv8.prepare( 'SELECT _meta."file_invalidate"($1, $2);', ['uuid', 'uuid'] );
        var rows = plan.execute( [fileId, entityId] );
    }

    var tableId = TG_TABLE_SCHEMA + '.' + TG_TABLE_NAME;

    var plan = plv8.prepare( 'SELECT json_agg(row_to_json(fc)) AS "fields" FROM _meta."FileColumns" AS fc WHERE "schemaName" = $1 AND "tableName" = $2;', ['text', 'text'] );
    var rows = plan.execute( [TG_TABLE_SCHEMA, TG_TABLE_NAME] );

    if (rows == null || rows.length < 1) {
        plv8.elog(NOTICE, "This table has no file-fields.");
        if(TG_OP === 'INSERT' || TG_OP === 'UPDATE') {
            return NEW;
        }
        return OLD;
    }

    for(var i in rows[0].fields) {
        var row = rows[0].fields[i];
        var columnName = row.columnName;

        if (TG_OP === 'INSERT') {
            // ID field is required
            if (NEW.id == null) {
                throw new Error('ID is required.');
            }
            if (NEW[columnName] == null) {
                continue;
            }
            // Validate all files, because they all are new.
            for(var j in NEW[columnName]) {
                validateFile(NEW[columnName][j], NEW.id, row.types)
            }
        }
        if (TG_OP === 'DELETE') {
            // ID field is required
            if (OLD.id == null) {
                throw new Error('ID is required.');
            }
            if (OLD[columnName] == null) {
                continue;
            }
            for(var j in OLD[columnName]) {
                invalidateFile(OLD[columnName][j], OLD.id)
            }
        }
        if (TG_OP === 'UPDATE') {
            // ID field is required and can not be changed
            if (NEW.id == null || OLD.id == null || NEW.id != OLD.id) {
                throw new Error('ID can not be changed.');
            }

            // If the field is neither in NEW nor in OLD it can be ignored
            if (NEW[columnName] == null && OLD[columnName] == null) {
                continue;
            }

            // If the field has been removed in NEW, all files can be invalidated (like delete)
            if (NEW[columnName] == null && OLD[columnName] != null) {
                for(var j in OLD[columnName]) {
                    invalidateFile(OLD[columnName][j], OLD.id)
                }
                continue;
            }

            // If the field has been added in NEW, all files can be validated (like insert)
            if (NEW[columnName] != null && OLD[columnName] == null) {
                for(var j in NEW[columnName]) {
                    validateFile(NEW[columnName][j], NEW.id, row.types)
                }
                continue;
            }
            
            // If the field is available in both, we need to diff
            if (NEW[columnName] != null && OLD[columnName] != null) {
                // Validate new files
                for(var j in NEW[columnName]) {
                    var fileId = NEW[columnName][j];
                    if(OLD[columnName].indexOf(fileId) < 0) {
                        validateFile(fileId, NEW.id, row.types)
                    }
                }
                // Invalidate old files
                for(var j in OLD[columnName]) {
                    var fileId = OLD[columnName][j];
                    if(NEW[columnName].indexOf(fileId) < 0) {
                        invalidateFile(fileId, NEW.id)
                    }
                }
            }
        }
    }
$$ LANGUAGE "plv8" SECURITY DEFINER;