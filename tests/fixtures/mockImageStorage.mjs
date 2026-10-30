// Route validation tests must never contact Cloud Storage.
export class Storage { bucket(){return {file(){throw Error("Unexpected Cloud Storage access in validation test");}};} }
