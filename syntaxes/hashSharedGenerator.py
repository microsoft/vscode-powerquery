import csv

value_mapping = {
    "DELETE": "entity.constant.other.powerquery",
    "GET": "entity.constant.other.powerquery",
    "HEAD": "entity.constant.other.powerquery",
    "PATCH": "entity.constant.other.powerquery",
    "POST": "entity.constant.other.powerquery",
    "PUT": "entity.constant.other.powerquery",
    "[Function]": "entity.name.function.powerquery",
    "[Record]": None,
    "[Table]": None,
    "[Number]": "constant.numeric.powerquery",
    "[Type]": "entity.support.type.powerquery",
    "en-US": "entity.support.type.powerquery",
}


def create_regex(iterable):
    base = "|".join(["({})".format(i) for i in iterable])
    return wrap_regex(base)


def wrap_regex(base):
    return "\\\\b({})\\\\b".format(base)


def is_float(x):
    try:
        float(x)
        return True
    except ValueError:
        return False


grouped_by_value = {}
with open("hashSHared.csv", "r", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        name = row["Name"]
        value = row["Value"]

        if value.isdigit() or is_float(value):
            value = "[Number]"

        elif value not in value_mapping:
            raise KeyError(value)

        grouped_by_value.setdefault(value, [])
        grouped_by_value[value].append(name)

grouped_by_mapping = {}
for tag, elements in grouped_by_value.items():
    mapped = value_mapping[tag]
    if not mapped:
        continue

    grouped_by_mapping.setdefault(mapped, [])
    grouped_by_mapping[mapped].extend(elements)

for mapped in sorted(grouped_by_mapping.keys()):
    elements = grouped_by_mapping[mapped]
    elements.sort(key=lambda s: len(s), reverse=True)
    print(mapped)
    print(create_regex(elements))
    print()
