import React from 'react';
import { Link } from 'react-router-dom';

const AdminIndex = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Page</h1>
      <ul>
        <li>
          <Link to="/admin/scale-shape-editor" className="text-blue-500 hover:underline">
            Scale Shape Editor
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default AdminIndex;