#!/usr/bin/env gjs
//
// Copyright (C) 2013 Colin Walters <walters@verbum.org>
//
// SPDX-License-Identifier: LGPL-2.0+
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the
// Free Software Foundation, Inc., 59 Temple Place - Suite 330,
// Boston, MA 02111-1307, USA.

const Gio = imports.gi.Gio;
const OSTree = imports.gi.OSTree;

function assertEquals(a, b) {
    if (a != b)
	throw new Error("assertion failed " + JSON.stringify(a) + " == " + JSON.stringify(b));
}

print('1..1')

let testDataDir = Gio.File.new_for_path('test-data');
testDataDir.make_directory(null);
testDataDir.get_child('some-file').replace_contents("hello world!", null, false, 0, null);

let repoPath = Gio.File.new_for_path('repo');
let repo = OSTree.Repo.new(repoPath);
repo.create(OSTree.RepoMode.ARCHIVE_Z2, null);

repo.open(null);

assertEquals(repo.get_mode(), OSTree.RepoMode.ARCHIVE_Z2);

repo.prepare_transaction(null);

let mtree = OSTree.MutableTree.new();
repo.write_directory_to_mtree(testDataDir, mtree, null, null);
let [,dirTree] = repo.write_mtree(mtree, null);
let [,commit] = repo.write_commit(null, 'Some subject', 'Some body', null, dirTree, null);
print("commit => " + commit);

// Test direct write APIs
let inline_content = "default 0.0.0.0\nloopback 127.0.0.0\nlink-local 169.254.0.0\n";
let regfile_mode = 33188; // 0o100000 | 0o644 (but in decimal so old gjs works)
let inline_checksum = repo.write_regfile_inline(null, 0, 0, regfile_mode, null, inline_content, null);
assertEquals(inline_checksum, "8aaa9dc13a0c5839fe4a277756798c609c53fac6fa2290314ecfef9041065873");
let written = false;
try {
    // Changed an a to b from above to make the checksum not match
    repo.write_regfile_inline("8baa9dc13a0c5839fe4a277756798c609c53fac6fa2290314ecfef9041065873", 0, 0, regfile_mode, null, inline_content, null);
    written = true;
} catch (e) {
}
if (written)
  throw new Error("Wrote invalid checksum");

repo.commit_transaction(null, null);

let [,root,checksum] = repo.read_commit(commit, null);
let child = root.get_child('some-file');
let info = child.query_info("standard::name,standard::type,standard::size", 0, null);
assertEquals(info.get_size(), 12);

// Write a ref and read it back
repo.prepare_transaction(null);
repo.transaction_set_refspec('someref', commit);
repo.commit_transaction(null, null);
let [,readCommit] = repo.resolve_rev('someref', false);
assertEquals(readCommit, commit);

// Delete a ref
repo.prepare_transaction(null);
repo.transaction_set_refspec('someref', null);
repo.commit_transaction(null, null);
[,readCommit] = repo.resolve_rev('someref', true);
assertEquals(readCommit, null);

print("ok test-core");
