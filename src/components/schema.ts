// Generated from schemas/component-package.schema.json. Do not edit by hand.
export const COMPONENT_PACKAGE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://zabarov.github.io/mirai/schemas/component-package.schema.json",
  "title": "Mirai Graph-Native Component Package",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "contract_version",
    "interfaces",
    "operation_contracts",
    "component_types",
    "component_instances",
    "program_implementations",
    "contextual_bindings",
    "canonical_write_allowed"
  ],
  "properties": {
    "contract_version": {
      "const": "1.0.0"
    },
    "interfaces": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/interface"
      }
    },
    "operation_contracts": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/operation"
      }
    },
    "component_types": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/componentType"
      }
    },
    "component_instances": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/componentInstance"
      }
    },
    "program_implementations": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/implementation"
      }
    },
    "contextual_bindings": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/binding"
      }
    },
    "canonical_write_allowed": {
      "const": false
    }
  },
  "$defs": {
    "strings": {
      "type": "array",
      "uniqueItems": true,
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "interface": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "operations"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "operations": {
          "$ref": "#/$defs/strings"
        }
      }
    },
    "operation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "inputs",
        "outputs",
        "required_capabilities"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "inputs": {
          "type": "array"
        },
        "outputs": {
          "type": "array"
        },
        "required_capabilities": {
          "$ref": "#/$defs/strings"
        }
      }
    },
    "componentType": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "implements",
        "exposes",
        "composes"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "implements": {
          "$ref": "#/$defs/strings"
        },
        "exposes": {
          "$ref": "#/$defs/strings"
        },
        "composes": {
          "$ref": "#/$defs/strings"
        },
        "state_contract": {
          "type": "string"
        }
      }
    },
    "componentInstance": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "instance_of",
        "scope"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "instance_of": {
          "type": "string"
        },
        "scope": {
          "type": "string"
        }
      }
    },
    "implementation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "operation",
        "program_ref",
        "program_digest"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "operation": {
          "type": "string"
        },
        "program_ref": {
          "type": "string"
        },
        "program_digest": {
          "type": "string",
          "pattern": "^sha256:[a-f0-9]{64}$"
        }
      }
    },
    "binding": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "component_type",
        "operation",
        "implementation",
        "priority"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "component_type": {
          "type": "string"
        },
        "operation": {
          "type": "string"
        },
        "implementation": {
          "type": "string"
        },
        "priority": {
          "type": "integer"
        },
        "scope": {
          "type": "string"
        },
        "conditions": {
          "type": "object"
        }
      }
    }
  }
} as const;
