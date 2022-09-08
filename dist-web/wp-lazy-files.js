function getLazyFiles() { var sa = []; 

return sa.map( function( a ) {
    return {
        path: a[0],
        filename: a[1],
        fullPath: a[2],
        size: a[3],
    };
} );
}
