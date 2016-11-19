/*
 *  Charles
 *  考虑到时间问题, 对数据存取算法不做优化, 简单的使用遍历完成
 *  2016-11-10 2:17:00 想到算法错误 
 */



(function ( window ){

var storage = window.localStorage;

// 数据库应该有的方法
// db
// - showDBS()
// - use( db_name )
// - dropDatabase()
// - createCollection( collection_name )
// 内部维护的数据
// - dbs     维护所有数据库
// - current 维护当前数据库

var identification = 0,
    toString = Object.prototype.toString;

function extend ( dest, obj ) {
    var k;
    for ( k in obj ) {
        if ( obj.hasOwnProperty( k ) ) {
            dest[ k ] = obj[ k ]
        }
    }
} 

function isArrayLike( array ) {
    if ( toString.call( array ) === '[object Array]' ) {
        return true;
    }

    var length = array && array.length && typeof array.length === 'number';
    return length && length >= 0;
}

function map( obj, callback ) {
    var k, i, res = [], tmp;
    if ( isArrayLike( obj ) ) { // 数组
        for ( i = 0; i < obj.length; i++ ) {
            if ( ( tmp = callback.call( obj[ i ], obj[ i ], i ) ) !== undefined ) {
                res.push( tmp );
            }
        }
    } else { // 对象
        for ( k in obj ) {
            if ( ( tmp = callback.call( obj[ k ], obj[ k ], k ) ) !== undefined ) {
                res.push( tmp );
            }
        }
    }
    return res;
}

function each( obj, callback ) {
    var k, i;
    if ( isArrayLike( obj ) ) { // 数组
        for ( i = 0; i < obj.length; i++ ) {
            if ( callback.call( obj[ i ], obj[ i ], i ) === false ) {
                break;
            }
        }
    } else { // 对象
        for ( k in obj ) {
            if ( callback.call( obj[ k ], obj[ k ], k ) === false ) {
                break;
            }
        }
    }
    return obj;
}


function getId() {
    var dateNum = +new Date;
    // var idString = ( "00000000000000000000000000000000" + identification )
    var idString = ( "00000000" + identification );
    idString = idString.slice( idString.length - 8 );
    identification++;
    return dateNum + idString;
}



var __master__ = 'jkdb.master',
    __namespace__ = 'jkdb.';




// db

// 内部维护的数据
// - __dbs__     维护所有数据库
// - __current__ 维护当前数据库
function Base () {
    this.__dbs__ = {};
    this.__current__ = __master__;
    this.__dbs__[ __master__ ] = {};
    // jkdb.master 作为 内存数据库

    // 保存当前操作数据集
    this.__current_collection__ = null;
}

// - getDBS()   返回所有数据库, 不要打印只返回数据库的名字集合
// - use( db_name )
// - dropDatabase()
// - createCollection( collection_name ) 
// - save
Base.prototype = {
    constructor: Base,
    
    // 显示所有数据库名
    getDBS: function () {
        return map( this.__dbs__, function ( v, k ) {
            return k;
        });
    },

    // 保存当前数据库
    save: function () {
        var current_db_name,
            json_data, json_string;
        
        current_db_name = this.__current__;

        if ( current_db_name === __master__ ) return; // 如果是 master 数据库, 则在内存中使用 

        json_data = this.__dbs__[ current_db_name ];

        json_string = JSON.stringify( json_data );
    
        storage.setItem( current_db_name, json_string );

        return this;
    },


    // 创建数据库 或 切换数据库
    use: function ( db_name ) {

        db_name = __namespace__ + db_name;

        var internalDB = this.__dbs__[ db_name ];

        this.save(); // 保存当前数据库

        if ( internalDB === undefined ) {
            this.__dbs__[ db_name ] = {}; // 创建数据库
            // :> 有待升级
            // 这里需要设计一个引用, 数据库对象在切换的时候需要将之前的数据库
            // 保存到 localStorage 中. 定义代理. 
        }

        this.__current__ = db_name; // 切换数据库名

        return this;
    },

    clearAll: function () {
        storage.clear();
        // 数据库呢?
        Base.call( this );
        return this;
    },

    // 删除当前数据库, 并切换至 jkdb.master
    dropDatabase: function () {
        var current_db_name = this.__current__;
        this.__current__ = __master__;

        storage.removeItem( current_db_name );
        return this;
    },


    // 创建 数据集( 表 )
    // 在当前数据库下创建表
    createCollection: function ( collection_name ) {
        this.__dbs__[ this.__current__ ][ collection_name ] = [];
        return this;
    }, 


    // dbs.createCollection( 'test' ).useCollection( 'test' ).insert( ... )
    // 切换数据集
    useCollection: function( collection_name ) {
        this.__current_collection__ = collection_name;
        return this;
    },

    // removeCollection
    // 删除数据集
    removeCollection: function ( collection_name ) {
        delete this.__dbs__[ this.__current__ ][ collection_name ];
        return this;
    },

    // 显示当前数据库下的所有数据集
    getCollections: function () {
        var collections = this.__dbs__[ this.__current__ ];
        return map( collections, function ( v, k ) {
            return k;
        });
    },






    // 基本 CRUD
    // 在当前数据库的数据集中插入数据
    insert: function ( document ) {
        // 在当前数据库下, 在当前表中插入数据

        document.id = getId();

        this.__dbs__[ this.__current__ ][ this.__current_collection__ ].push( document );
        this.save();

        return this;
    },

    // 删除数据
    remove: function ( document ) {
        // 在数据 __dbs__[ __current__ ][ collection ]中找是否有该数据
        var collection = this.__dbs__[ this.__current__ ][ this.__current_collection__ ];
        var indexes = [];
        for ( var i = 0; i < collection.length; i++ ) {
            // 查看 collection[ i ] 的数据是否与 document 匹配
            if ( compare( collection[ i ], document ) ) {
                indexes.push( i );
            }
        }

        // 删除数据
        for ( var i = indexes.length - 1; i >= 0; i-- ) {
            collection.splice( i, 1 );
        }


        return this.save();
    },

    // 修改
    update: function ( document, newDatas ) {
        // 将数据先找出来, 在一一更新
        var collection = this.find( document );
        each( collection, function () {
            var that = this;
            each( newDatas, function ( v, k ) {
                that[ k ] = v;
            });
        });
        return this;
    },



    // 查询
    find: function ( document ) {
        var collection = this.__dbs__[ this.__current__ ][ this.__current_collection__ ];
        return map( collection, function ( ) {
            if ( compare( this, document ) ) {
                return this;
            }
        });
    },
    findOne: function ( document ) {
        var collection = this.__dbs__[ this.__current__ ][ this.__current_collection__ ];
        var res;
        each( collection, function () {
            if ( compare( this, document ) ) {
                res = this;
                return false;
            }
        });
        return res;
    }
};


// function compare( obj1, obj2 ) {
//     var k1, k2
//     for ( k1 in obj1 ) {

//         for ( k2 in obj2 ) {
//             // 判断 k1, k2 相同的时候, 两个数据要一致
//             if ( k1 === k2 && obj1[ k1 ] != obj2[ k2 ] ) {
//                 return false;
//             }

//         }
//     }
//     return true;
// }

function compare( source, obj ) {
    var k;
    // obj 中的属性必须 source 也含有, 同时数据相同才取出来
    // 而且要全部比较
    for ( k in obj ) {
        if ( source.hasOwnProperty( k ) ) {
            if ( source[ k ] != obj[ k ] ) {
                return false;
            }
        } else {
            // 少属性
            return false;
        }
    }
    return true;
}






















window.dbs = new Base();

})( window );